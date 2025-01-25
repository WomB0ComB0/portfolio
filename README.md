# Lint and Testing Workflows

This repository contains GitHub Actions workflows focused on linting, testing, and code quality for a JavaScript/Node.js project. The workflows utilize various tools and libraries to ensure code quality, test coverage, and deployment mechanisms.

## Major Parts of the Code

### 1. Lint Workflow

- **Trigger:** This workflow is triggered on pushes to the `master` branch and on pull requests.
- **Environment Variables:** The workflow uses several environment variables, many of which are sourced from GitHub Secrets for security.
- **Steps:**
  - **Checkout Repository:** Uses `actions/checkout` to clone the repository.
  - **Setup Bun:** Uses `oven-sh/setup-bun` to set up the Bun runtime.
  - **Install Dependencies:** Runs `bun install` to install project dependencies.
  - **Lint Code:** Runs `bun run lint` to lint the codebase.
  
### 2. Testing Workflow

- **Trigger:** This workflow is similar to the lint workflow and is also triggered on pushes to the `master` branch and pull requests.
- **Environment Variables:** Sets up the same environment variables as the lint workflow.
- **Steps:**
  - **Checkout Repository:** Clones the repository.
  - **Setup Bun:** Sets up the Bun runtime.
  - **Install Dependencies:** Installs the necessary dependencies.
  - **Build Code:** Runs `bun run build` to compile the code.
  - **Run Tests:** Executes tests using `bun run test`.

### 3. Playwright Tests Workflow

- **Trigger:** This workflow runs Playwright tests and is triggered on pushes to the `master` branch.
- **Steps:**
  - **Checkout Repository:** Clones the repository.
  - **Setup Bun:** Sets up the Bun runtime.
  - **Install Dependencies:** Installs the necessary dependencies.
  - **Install Playwright Browsers:** Ensures that all browsers required for testing are installed.
  - **Run Playwright Tests:** Executes end-to-end tests using Playwright.

### 4. Next.js Bundle Analysis Workflow

- **Trigger:** This workflow is triggered on pushes to the `master` branch and on pull requests.
- **Steps:**
  - **Checkout Repository:** Clones the repository.
  - **Install Dependencies:** Installs the necessary dependencies.
  - **Build Next.js App:** Builds the Next.js application.
  - **Analyze Bundle Size:** Analyzes the application bundle size and uploads the report.

### 5. CodeQL Workflow

- **Trigger:** This workflow is scheduled to run on Fridays and is also triggered on pushes and pull requests.
- **Steps:**
  - **Checkout Repository:** Clones the repository.
  - **Initialize CodeQL:** Sets up CodeQL for security analysis.
  - **Autobuild:** Automatically builds the project.
  - **Perform CodeQL Analysis:** Runs CodeQL analysis on the codebase.

### 6. Release Workflow

- **Trigger:** This workflow is triggered manually via the GitHub Actions UI or on pushes to the `master` branch.
- **Steps:**
  - **Checkout Repository:** Clones the repository.
  - **Semantic Release:** Uses `cycjimmy/semantic-release-action` to automate the versioning and release process based on commit messages.

## Installation Instructions

To set up this project locally, follow these steps:

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/YourUsername/YourRepository.git
   cd YourRepository
   ```

2. **Install Bun:**
   Make sure you have Bun installed on your machine. You can install it from [the Bun website](https://bun.sh/).

3. **Install Dependencies:**
   ```bash
   bun install
   ```

4. **Set Up Environment Variables:**
   You need to configure your GitHub Secrets for necessary environment variables. This can include API keys, project IDs, etc., as indicated in the workflows.

## Usage Instructions

- **Lint the Code:**
   You can manually run the linting process using:
   ```bash
   bun run lint
   ```

- **Run Tests:**
   To run the tests, execute:
   ```bash
   bun run test
   ```

- **Build the Application:**
   To build the Next.js application, run:
   ```bash
   bun run build
   ```

- **Run Playwright Tests:**
   To execute end-to-end tests using Playwright, run:
   ```bash
   bun run e2e:ci
   ```

- **Analyze Bundle Size:**
   To analyze the bundle size, you can trigger the workflow manually or integrate it into your CI/CD pipeline.

- **Release the Application:**
   You can release the application using the Semantic Release workflow, which will automatically handle versioning and deployment based on your commit messages. This can be triggered manually via the GitHub Actions UI.

## Conclusion

This repository utilizes GitHub Actions to automate linting, testing, and deployment processes for a JavaScript/Node.js project. Follow the installation and usage instructions to set up the environment locally and leverage the workflows for maintaining code quality and deploying your application.# Kodchasan Project

## Overview

Kodchasan is a web application that provides various functionalities including a guestbook, a dashboard showing user statistics, a Spotify integration for music stats, and a Google Maps display for visited places. The project utilizes modern web technologies like React, Next.js, and Tailwind CSS for styling.

## Major Features

1. **Guestbook**: Users can leave messages, which can be viewed by others. The guestbook utilizes a custom API for managing messages.
  
2. **Dashboard**: Displays user statistics including Discord status and various statistics fetched from different APIs.
  
3. **Spotify Integration**: Showcases the current playing song, top artists, and top tracks using the Spotify API.
  
4. **Google Maps Integration**: Displays a map with markers for various notable locations.
  
5. **Responsive Design**: The application is designed to be fully responsive, providing a seamless experience across devices.

## Technologies Used

- **Frontend**: React, Next.js, Tailwind CSS
- **Backend**: Node.js, Express.js (for API)
- **Database**: MongoDB (for storing messages)
- **APIs**: Discord API, Spotify API, Google Maps API
- **State Management**: React Query for data fetching and state management.

## Installation Instructions

To set up the project locally, follow these steps:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/cadsondemak/Kodchasan.git
   cd Kodchasan
   ```

2. **Install dependencies**:
   Make sure you have Node.js installed. Then run:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env.local` file in the root of the project and add your configuration:
   ```env
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=your_google_maps_map_id
   NEXT_PUBLIC_DISCORD_ID=your_discord_id
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_key
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open your web browser and go to `http://localhost:3000`.

## Usage Instructions

- **Guestbook**: Navigate to the guestbook section to leave a message.
- **Dashboard**: View your statistics and Discord status.
- **Spotify Stats**: Check your current track and top artists.
- **Places**: Explore the map and see the locations you’ve visited.
- **Resume**: Download your resume or view it directly in the browser.

## Contributing

If you wish to contribute to this project, please fork the repository and submit a pull request. Ensure that your code follows the project's coding standards and passes all tests.

## License

This project is licensed under the SIL Open Font License, Version 1.1. See the [LICENSE](LICENSE) file for more details.

## Acknowledgements

Special thanks to the open-source community and contributors who made this project possible.# My Links Application

This repository contains a web application designed to showcase personal links and a guestbook functionality. The application utilizes React components and Tailwind CSS for styling, providing a responsive and modern user interface.

## Major Parts of the Code

1. **Main Components**:
   - **Links Component**: Renders a list of links with icons, names, and values. Each link is clickable and opens in a new tab.
   - **Guestbook Component**: Displays a guestbook section where users can leave messages.
   - **Blog Component**: Renders a blog section to display blog posts.

2. **Pages**:
   - **GuestbookPage**: Wraps the `GuestbookComponent` in a layout and provides styling for the guestbook section.
   - **BlogPage**: Renders the `Blog` component within a layout, styled for a blog post display.
   - **Hire Page**: A simple redirect to the hire page.

3. **Styling**: The application uses Tailwind CSS for styling, ensuring a consistent and modern look across all components.

## Installation Instructions

To get started with the application, follow these steps:

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/yourusername/my-links-app.git
   cd my-links-app
   ```

2. **Install Dependencies**:
   Ensure you have Node.js installed. Run the following command to install the necessary dependencies:
   ```bash
   npm install
   ```

3. **Run the Development Server**:
   Start the application in development mode:
   ```bash
   npm run dev
   ```

4. **Open the Application**:
   Navigate to `http://localhost:3000` in your web browser to view the application.

## Usage Instructions

- **Viewing Links**: The main interface displays links where users can click to be redirected to external sites.
- **Guestbook**: Users can leave messages in the guestbook section.
- **Blog Section**: Explore blog posts and articles that are part of the application.

## Contributing

Contributions are welcome! If you have suggestions for improvements or features, please fork the repository and submit a pull request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.