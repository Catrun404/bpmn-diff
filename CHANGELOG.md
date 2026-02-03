<!-- Keep a Changelog guide -> https://keepachangelog.com -->

# BPMN-Diff Changelog

## [Unreleased]

### Fixed

- Fix the tool window ID casing

## [1.0.0] - 2026-02-03

### Added

- Ability to use shortcuts for already existing actions:
    - `Show Diff` toggle
    - `Refresh` (default: Ctrl+R)
- New tool window actions:
    - `Previous File` in Git Mode (inherited from `Compare Previous File`, default: Alt+Shift+Left)
    - `Next File` in Git Mode (inherited from `Compare Next File`, default: Alt+Shift+Left)
    - `Open In Associated Application` (inherited from `Open In Associated Application`)

### Changed

- Move controls from js into tool window actions:
    - `Show Diff` toggle
    - `Previous File` button
    - `Next File` button
    - Left/Right file selectors for Manual Mode
- Refactored ToolWindow/UI implementation for improved modularity and consistency
- Standardized plugin naming and UI text to `BPMN-Diff` across the project

### Removed

- Removed `Clear` and `Compare` actions from the canvas

## [0.1.0] - 2026-01-28

### Changed

- Move mode switching buttons into tool window actions

## [0.0.2] - 2026-01-09

### Added

- Dynamic tab titles for the BPMN-Diff tool window based on the selected files
- Option to open BPMN-Diff contents in new tabs
- Option to reload BPMN-Diff tool window content

## [0.0.1] - 2026-01-09

### Added

- Web-based BPMN-Diff viewer integration
- Support for comparing BPMN files using Git history
- Settings page for configuring the default branch and other preferences
- Initial scaffold created
  from [IntelliJ Platform Plugin Template](https://github.com/JetBrains/intellij-platform-plugin-template)

### Changed

- Refactored BPMN-Diff logic for better performance and reliability
- Simplified marker rendering and improved handling of empty definitions
- Optimized Git diff commands for faster execution
- Enhanced UI/UX for consistency with IntelliJ Platform
- Streamlined plugin resources and removed unused assets

[Unreleased]: https://github.com/Catrun404/bpmn-diff/compare/v1.0.0...HEAD

[1.0.0]: https://github.com/Catrun404/bpmn-diff/compare/v0.1.0...v1.0.0

[0.1.0]: https://github.com/Catrun404/bpmn-diff/compare/v0.0.2...v0.1.0

[0.0.2]: https://github.com/Catrun404/bpmn-diff/compare/v0.0.1...v0.0.2

[0.0.1]: https://github.com/Catrun404/bpmn-diff/commits/v0.0.1
