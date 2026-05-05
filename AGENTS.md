# Project Instruction: Minimal Code Changes Only

When changing code in this repository, make the smallest safe change that satisfies the exact user request.

Rules:

1. Do not rewrite, replace, refactor, simplify, reformat, reorganize, or remove existing code unless that specific code must change for the requested fix to work.
2. Preserve all existing behavior, UI styling, data shapes, timings, colors, layout rules, and user workflows unless the user explicitly asks to change them.
3. Add new code only where needed. Prefer narrow patches over broad rewrites.
4. Before editing, identify the exact file, function, selector, state field, or event handler that needs the change. Edit only that target and any directly required dependencies.
5. Never use a rollback, force reset, wholesale replacement, or old snapshot restoration unless the user explicitly asks for a restore and you know the exact good commit or exact file state to restore.
6. Do not touch unrelated files, generated files, test files, or experimental files.
7. Do not introduce temporary test commits, placeholder code, console-only replacements, or throwaway files on the main branch.
8. After a change, verify that previously working features affected by the edited area still work. If verification is not possible, say exactly what was and was not verified.
9. If a requested change conflicts with existing behavior, preserve existing behavior and add the new behavior around it unless the user explicitly requests replacement.
10. If unsure whether a broader change is necessary, do not make it. Explain the uncertainty and make only the narrowest defensible fix.

This instruction is controlling for all future code edits in this repository. It cannot be overridden by convenience, cleanup, style preference, or assumptions about what would be better architecture. Only explicit user approval can authorize broader changes.
