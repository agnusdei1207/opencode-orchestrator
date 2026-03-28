const ANSI_PATTERN = /\u001B(?:\][^\u0007\u001B]*(?:\u0007|\u001B\\)|[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
const C0_CONTROL_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

type ToastSanitizeOptions = {
    maxLength: number;
    maxLines: number;
    singleLine?: boolean;
};

function stripTerminalSequences(value: string): string {
    return value
        .replace(/\r\n?/g, "\n")
        .replace(ANSI_PATTERN, "")
        .replace(C0_CONTROL_PATTERN, "");
}

function truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
        return value;
    }

    return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function sanitizeInternal(value: string, options: ToastSanitizeOptions): string {
    const stripped = stripTerminalSequences(value);

    if (options.singleLine) {
        const singleLine = stripped.replace(/\s+/g, " ").trim();
        return singleLine ? truncate(singleLine, options.maxLength) : "";
    }

    const rawLines = stripped.split("\n");
    const lines: string[] = [];

    for (const rawLine of rawLines) {
        const normalizedLine = rawLine.replace(/\t/g, "    ").replace(/[^\S\n]+/g, " ").trim();

        if (normalizedLine.length === 0) {
            if (!options.singleLine && lines.length > 0 && lines[lines.length - 1] !== "") {
                lines.push("");
            }
            continue;
        }

        lines.push(normalizedLine);

        if (lines.length >= options.maxLines) {
            break;
        }
    }

    const collapsed = lines.join("\n").trim();

    if (!collapsed) {
        return "";
    }

    const truncated = truncate(collapsed, options.maxLength);
    if (rawLines.length > options.maxLines && !truncated.endsWith("…")) {
        return truncate(`${truncated}\n…`, options.maxLength);
    }

    return truncated;
}

export function sanitizeToastTitle(value: string): string {
    return sanitizeInternal(value, {
        maxLength: 80,
        maxLines: 1,
        singleLine: true,
    });
}

export function sanitizeToastInline(value: string, maxLength: number = 120): string {
    return sanitizeInternal(value, {
        maxLength,
        maxLines: 1,
        singleLine: true,
    });
}

export function sanitizeToastMessage(value: string, maxLength: number = 600, maxLines: number = 10): string {
    return sanitizeInternal(value, {
        maxLength,
        maxLines,
    });
}
