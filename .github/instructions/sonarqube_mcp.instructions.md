<!--
  Copyright (c) 2026 Mike Odnis

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
-->

---

## applyTo: '\*_/_'

These are some guidelines when using the SonarQube MCP server.

# Important Tool Guidelines

## Basic usage

- **IMPORTANT**: After you finish generating or modifying any code files at the very end of the
  task, you MUST call the `analyze_file_list` tool (if it exists) to analyze the files you created
  or modified.
- **IMPORTANT**: When starting a new task, you MUST disable automatic analysis with the
  `toggle_automatic_analysis` tool if it exists.
- **IMPORTANT**: When you are done generating code at the very end of the task, you MUST re-enable
  automatic analysis with the `toggle_automatic_analysis` tool if it exists.

## Project Keys

- When a user mentions a project key, use `search_my_sonarqube_projects` first to find the exact
  project key
- Don't guess project keys - always look them up

## Code Language Detection

- When analyzing code snippets, try to detect the programming language from the code syntax
- If unclear, ask the user or make an educated guess based on syntax

## Branch and Pull Request Context

- Many operations support branch-specific analysis
- If user mentions working on a feature branch, include the branch parameter

## Code Issues and Violations

- After fixing issues, do not attempt to verify them using `search_sonar_issues_in_projects`, as the
  server will not yet reflect the updates

# Common Troubleshooting

## Authentication Issues

- SonarQube requires USER tokens (not project tokens)
- When the error `SonarQube answered with Not authorized` occurs, verify the token type

## Project Not Found

- Use `search_my_sonarqube_projects` to find available projects
- Verify project key spelling and format

## Code Analysis Issues

- Ensure programming language is correctly specified
- Remind users that snippet analysis doesn't replace full project scans
- Provide full file content for better analysis results
