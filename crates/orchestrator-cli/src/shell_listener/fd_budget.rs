use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};

pub const FD_HEADROOM: u64 = 64;
pub const EST_FDS_PER_SESSION: u64 = 5;
pub const PRESSURE_WARN_PCT: u64 = 80;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FdBudget {
    soft_limit: u64,
    headroom: u64,
    fds_per_session: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FdStatReport {
    pub soft_limit: u64,
    pub headroom: u64,
    pub fds_per_session: u64,
    pub max_sessions: u64,
    pub active_sessions: u64,
    pub est_fds_in_use: u64,
    pub pressure_pct: u64,
}

#[derive(Debug, Clone)]
pub struct FdAccounting {
    pub budget: FdBudget,
    pub active: ActiveSessionCounter,
}

#[derive(Debug, Clone, Default)]
pub struct ActiveSessionCounter(Arc<AtomicU64>);

#[derive(Debug)]
pub struct ActiveSessionGuard(Arc<AtomicU64>);

impl FdBudget {
    pub fn new(soft_limit: u64, headroom: u64, fds_per_session: u64) -> Self {
        Self {
            soft_limit,
            headroom,
            fds_per_session: fds_per_session.max(1),
        }
    }

    pub fn max_sessions(&self) -> u64 {
        self.soft_limit.saturating_sub(self.headroom) / self.fds_per_session
    }

    pub fn admits(&self, active_sessions: u64) -> bool {
        active_sessions < self.max_sessions()
    }

    pub fn pressure_pct(&self, active_sessions: u64) -> u64 {
        let max = self.max_sessions();
        if max == 0 {
            return 100;
        }
        (active_sessions.saturating_mul(100) / max).min(100)
    }

    pub fn is_under_pressure(&self, active_sessions: u64) -> bool {
        self.pressure_pct(active_sessions) >= PRESSURE_WARN_PCT
    }

    pub fn report(&self, active_sessions: u64) -> FdStatReport {
        FdStatReport {
            soft_limit: self.soft_limit,
            headroom: self.headroom,
            fds_per_session: self.fds_per_session,
            max_sessions: self.max_sessions(),
            active_sessions,
            est_fds_in_use: active_sessions.saturating_mul(self.fds_per_session),
            pressure_pct: self.pressure_pct(active_sessions),
        }
    }
}

impl FdAccounting {
    pub fn new(budget: FdBudget, active: ActiveSessionCounter) -> Self {
        Self { budget, active }
    }

    pub fn report(&self) -> FdStatReport {
        self.budget.report(self.active.get())
    }
}

impl ActiveSessionCounter {
    pub fn new() -> Self {
        Self(Arc::new(AtomicU64::new(0)))
    }

    pub fn get(&self) -> u64 {
        self.0.load(Ordering::Acquire)
    }

    pub fn enter(&self) -> ActiveSessionGuard {
        self.0.fetch_add(1, Ordering::AcqRel);
        ActiveSessionGuard(self.0.clone())
    }
}

impl Drop for ActiveSessionGuard {
    fn drop(&mut self) {
        let mut current = self.0.load(Ordering::Acquire);
        loop {
            if current == 0 {
                return;
            }
            match self.0.compare_exchange_weak(
                current,
                current - 1,
                Ordering::AcqRel,
                Ordering::Acquire,
            ) {
                Ok(_) => return,
                Err(actual) => current = actual,
            }
        }
    }
}

pub fn default_budget(soft_limit: u64) -> FdBudget {
    FdBudget::new(soft_limit, FD_HEADROOM, EST_FDS_PER_SESSION)
}

#[cfg(unix)]
pub fn current_nofile_soft_limit() -> u64 {
    const FALLBACK_SOFT_LIMIT: u64 = 1024;
    let mut rlim = libc::rlimit {
        rlim_cur: 0,
        rlim_max: 0,
    };
    // SAFETY: getrlimit writes to the initialized local rlimit struct.
    let rc = unsafe { libc::getrlimit(libc::RLIMIT_NOFILE, &mut rlim) };
    if rc != 0 {
        return FALLBACK_SOFT_LIMIT;
    }
    #[allow(clippy::unnecessary_cast)]
    {
        rlim.rlim_cur as u64
    }
}

#[cfg(not(unix))]
pub fn current_nofile_soft_limit() -> u64 {
    1024
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn budget_admits_until_max_reached() {
        let budget = FdBudget::new(1024, 64, 5);
        let max = budget.max_sessions();
        assert!(budget.admits(max - 1));
        assert!(!budget.admits(max));
    }

    #[test]
    fn pressure_saturates() {
        let budget = FdBudget::new(1024, 64, 5);
        assert_eq!(budget.pressure_pct(0), 0);
        assert_eq!(budget.pressure_pct(1_000_000), 100);
    }

    #[test]
    fn active_guard_decrements_on_drop() {
        let counter = ActiveSessionCounter::new();
        let guard = counter.enter();
        assert_eq!(counter.get(), 1);
        drop(guard);
        assert_eq!(counter.get(), 0);
    }
}
