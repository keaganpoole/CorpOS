# Nodemere film release rules

- Keagan requires a recoverable version for every film update. Before editing,
  save the current prepared source package and matching preview in a new folder
  under the chat delivery `outputs/versions` directory. Verify the archive before
  changes. Never overwrite an existing release folder.
- Package each completed revision separately, with its preview, source, metadata,
  and review notes. Only then refresh the latest top-level delivery files.
- See `VERSIONS.md` for the delivery path and safe restore instructions. Restore
  into a fresh sibling folder; preserve the current project.
- Export 4K only when Keagan explicitly requests it.
- Do not enlist other agents without Keagan's explicit permission.
- Preserve the native product UI and source assets. Use fictional demo state;
  never trigger real appointments, outbound calls, or generation APIs for the film.
