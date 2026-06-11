# ╔══════════════════════════════════════════════════════════╗
# ║  POST-WORK MANDATORY AUDIT — Post-work Mandatory Audit    ║
# ╚══════════════════════════════════════════════════════════╝

> ⛔ **Must be executed after all work is completed. Cannot be skipped or performed superficially.**
> The more changes there are, the more critical this step becomes.
> **"Verified" using grep/pattern matching is ❌ — perform the audit directly.**

---

## Full System Safety, Connectivity, and Consistency Audit (MANDATORY)

### ▸ Safety
```
☑ 0 references to deleted code (Dead references: 0)
☑ 0 consumers missing migration to the new structure
☑ 0 build errors · 0 static analysis errors
☑ 100% test pass (Regressions: 0)
```

### ▸ Connectivity — Open the actual code and trace line-by-line. No grep.
```
☑ All import/export paths traced and verified
☑ Dynamic connections (Registry/Events/DI/String dispatch) traced and verified
☑ Checked consistency of Barrel/Entry point public APIs
☑ Re-validated 1:1 matching of Producer→Consumer fields
☑ 0 orphaned code (missing wire-up)
```

### ▸ Consistency
```
☑ Naming conventions for new modules/files fully unified
☑ Hierarchical structure consistency maintained (Presentation/Business/Infrastructure)
☑ Constant/type references all point to current definitions
☑ Documentation (README/ARCHITECTURE/CHANGELOG) reflects current structure
```

### ▸ Full Sync
```
☑ Test code: Signatures, imports, assertions, and fixtures reflect current source
☑ 0 orphaned tests / 0 missing tests
☑ All references updated when type definitions change
☑ All consumer paths updated when constants/configs are moved or renamed
☑ Mocks/Stubs reflect current contract
☑ Documentation (README, ARCHITECTURE, CHANGELOG, ADR) fully reflects current structure
```

### ▸ Project Impact Analysis
```
☑ Full survey of upstream and downstream dependencies for modified modules
☑ Followed through from smallest dependencies to structural and micro flows — thoroughly
☑ Confirmed no issues. If issues are found, report and fix immediately.
```

> ✅ Mark the work as complete ONLY after passing **all** items on this checklist.
