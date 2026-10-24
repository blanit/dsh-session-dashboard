# Known limitations

- The card takes space at the sidebar footer (5 rows by default plus header/filters; up to 10 rows expanded), so the Workspaces region shrinks accordingly; the card never overlays it.
- Archived sessions are hidden by default (filtered with the Workspace archive set, matching the sidebar default); this version has no "show archived" switch.
- No search or grouping inside the card (space is limited); the sidebar's own session search still applies.
- The "Working on" / "Last" subtitles and the "Completed · N turns" count come from projections (`todos` / `turnOutline` / `sessionStats`); without a cached projection they fall back to "Working… / Idle / Completed". Status glyphs and filters are driven directly by running state and pending interactions.
- No session management actions (rename / archive / pin); clicking a row only opens the session, management stays in the sidebar.
- Depends on the sidebar's `sidebar.footer.action` seat; if a future sidebar implementation removes that seat the card will not render (other UI is unaffected).
