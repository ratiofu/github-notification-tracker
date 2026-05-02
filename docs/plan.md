# CLI GitHub Notification Tracker

## Overview

A small CLI tool, `ght`, will render a persistent screen to display a subset of GitHub notifications that the user may be interested in and update that list regularly.

## Domain Language

TODO: domain language definitions to be provided as part of requirement refinements

## Requirements


### Product Requirements

**P-1.** The list of notifications is updated at as frequently as technically feasible. If the CLI tool can actively and efficiently receive push notifications, go that route. If only polling is available, default to a configurable polling interval of 30 seconds, or even more if that's allowed by whatever polling mechanism used without causing rate limiting.

**P-2.** The user can configure the type of notifications they want to display. The list of available notification types will be determined during requirements refinement.

**P-3.** For each notification, two lines are rendered, one for the notification content itself and one for information on the parent. If no parent is available, a single line is entered. The exact relationships between parent objects and notifications will be clarified as part of requirement refinement. Generally, the parent is a PR and the notification some action taken on the PR.

**P-4.** Debug mode: A command [D] exits to toggle the view to show all notifications in raw form without links or formatting, but the same kind of navigation help, so that the developer can slowly built up parsing and rendering strategies for each event type.

**P-4.** Notifications can be marked as read, both in normal and in debug mode.

**P-5.** A filter to show only unread notifications or all of them can be toggled

**P-6.** A single-line footer with the number of unread notifications and a list of commands; the footer can be toggled on and of with [F]

**P-7.** Notification rendering of PR comments and approvals: Those two are the primary notification types to support from the start.

  1st line: {selector} {notification-type} {relative-time} {notification-text} {unread-status}
  2nd line:            {PR #} {PR title}

  Whereas

  {selector}: a marker to show the currently selected, active notification (aka focus); may already have a default provided by the UI toolkit
  {notification-type} a short, English word label mapped to an actual notification type. Labels may potentially include emojis


**P-8.** Individually printented lines never wrap and are re-rendered when the text window size changes

**P-9.** in addition to showing a marker on the active notification (focus), the notification itself is rendered in brighter colors corresponding to the default, duller colors used for rendering unfocused notifications

**P-10.** Notifications can be filtered by user; pressing [U] renders a list of all users who where active in the repo in the last 7 calendar days; the user can mark one or more as selected or clear the list; the selected list is persisted in the config. Only notifications for the selected users are shown and counted. An empty list means "all users"

**P-11.** Notifications can be filtered by team; the command trigger is [T] and otherwise it works the same as the user filter


### General Requirements

**G-1.** All configuration of the tool must support a configuration file at ~/.config/ght/config.yaml that can also be overridden via command line arguments, with both short and long flags supported. This requires a centralized configuration management.

**G-2.** For selected configuration, the user changes made during runtime are stored ~/.config/ght/config.yaml; generally, the current view configuration (debug mode on/off, show unread only on/off, show footer on/off, etc.) is stored the moment the user changes the setting so it's persisted

**G-3.** Filtering for notifications is done at the "effective" model level. A given notification may not have enough information to participate in filters, such as missing the team or user information. Find the related parent object and use thaat as a basis for filtering. From the filter perspective, the notification is (left) joined with it's parent object's meta data


### Engineering Requirements

**E-1.** use modern, common, open source code quality tooling, such as oxfmt and oxlint for TypeScript.
**E-2.** split code into units that enable thorough unit test with high coverage (vitest + coverage)
**E-3.** use the "functional core, imperitive shell" pattern wherever possible
**E-4.** make the interfaces for imperitive shell implementations easily mockable
**E-5.** keep an internal application state model separate from the rendering and re-render on window size change
**E-6.** user per-object type rendering strategies so we can swiftly add support for more strategies
**E-7.** all colors referenced are encoded in a single Theme with semantic color constants; the theme is passed to the rendering layer

For the concrete technical approach of how to obtain and listen for notifications, the agent will provide implementation options and iterate together with the human until an approach is settled.


## Data Model

TODO: build the data model during requirements refinement. Agent to propose an initial data model and iterate with human until it is complete.

## Command and Configuration Overview

single-letter commands are case-insensitive by default, unless specified otherwise

* [Enter] opens the exact notification target URL in the browser, such as to a comment or commit
* cursor keys ([up], [down]) navigate the list of notifications up or down
* [Space] toggles a notification as read or unread
* [R] toggles the "unread notifications only" between on (show unread only) and off (show all)
* [D] toggles between the debug mode for showing all raw notifications
* [F] toggle the footer
* [U] displays the user filter list

Unless specificied otherwise, command characters are the same as the corresponding short CLI flag


## General Guidance

For the UI implementation, assume the following dependencies

@clack/prompts
citty
picocolors

If using `gh` to implement the requirements, use `execa`

You may follow _some_ of the patterns used in the GitX project at `../gitx`

## Agent Notes

{area for the agent to track notes, key insights, and memories about this plan}

## Tasks

- [ ] complete authoring plan together with the agent
