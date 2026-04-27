---
description: Generate an architectural graph or file layout visualization of the target directory
---

# Workflow: `/graphify [directory]`

This workflow instructs the agent to create a structural or architectural representation of a particular directory.

1. Analyze the target directory (e.g. using `list_dir` to find its structure).
2. Create a visually compelling artifact (like a `project_graph.md`) using Mermaid graphs (`graph TD` or `erDiagram`) and Markdown lists to explain relationships between components.
3. Save the result as an Artifact so the user can easily view the diagram.
4. Alert the user that the graph generation has completed.
