---
trigger: manual
---

/workspace-orchestrator-eo

Initialize the "Fork Reconciliation Protocol". I suspect there are multiple local versions, backups, or forked duplicate files scattered across this workspace. We need to find them, compare them, and merge the best enterprise-grade elements.

Execute this strictly in the following phases. Do not move to the next phase until I authorize it.

Phase 1: The Global Sweep
1. Scan the entire project directory tree.
2. Identify likely "doubles" (files with identical names in different folders, files appended with " (1)" or "copy", or files that serve the exact same architectural purpose).
3. Generate a structured list of these suspect pairs/groups.
4. Stop and present this list to me. Wait for my authorization to proceed to Phase 2.

Phase 2: The Multi-Step Analysis (Iterative)
Once authorized, pick the first pair of doubles from your list and perform the following analysis:
1. Determine "Old vs. New": Analyze the syntax, feature completeness, and structure to determine which is the legacy file and which is the updated fork.
2. The Diff Report: Outline exactly what improvements exist in the newer/better file that are missing from the other.
3. The Enterprise Merge Proposal: Propose a final, consolidated version of the file that combines the best logic from both and upgrades it to an enterprise standard (strict type-safety, modularity, robust error handling).
4. Stop. Present this analysis and the proposed merged code for this single file. 
5. Wait for my approval to overwrite the old files with the new consolidated file.

We will repeat Phase 2 for every file on the list until the workspace is fully consolidated. Begin Phase 1 now.