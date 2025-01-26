# README.md

## Project Overview

This repository contains a web application built using Next.js, featuring various functionalities such as a guestbook, a blog, user statistics, and integration with Spotify. The application utilizes Firebase for authentication and real-time data management, and it is styled using Tailwind CSS for a modern look and feel. Additionally, it contains GitHub Actions workflows for continuous integration, testing, linting, and deployment.

## Major Parts of the Code

1. **Components**: The application is modularized into reusable components for better maintainability. Key components include:
   - **Discord**: Displays Discord status and user information.
   - **Blog**: Fetches and displays blog posts.
   - **Guestbook**: Allows users to leave messages and view existing messages.
   - **Statistics**: Displays user statistics such as age, site views, and coding hours.
   - **Pricing**: Offers various service tiers for hiring.

2. **Pages**: The application contains several pages, each serving a specific purpose:
   - **Dashboard**: An overview page displaying statistics and Discord status.
   - **Blog Page**: Displays the latest blog posts.
   - **About Page**: Contains information about the author and skills.
   - **Guestbook Page**: Allows users to interact with the guestbook.
   - **Resume Page**: Displays the author's resume.
   - **Hire Page**: Offers service plans for hiring the author.
   - **Links Page**: Provides links to various platforms for connecting with the author.
   - **Spotify Page**: Shows the user's current Spotify tracks and top artists.

3. **Workflows**: The repository includes GitHub Actions workflows for:
   - **Bundle Analysis**: Analyzes the bundle size of the application.
   - **CodeQL**: Scans the code for security vulnerabilities.
   - **Playwright Tests**: Runs end-to-end tests for the application.
   - **Linting**: Ensures code quality and consistency.
   - **Release Management**: Automates the release process using semantic versioning.

## Installation Instructions

To get started with this project, follow these steps:

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/WomB0ComB0/your-repo-name.git
   cd your-repo-name
   ```

2. **Install Dependencies**:
   Make sure you have Node.js installed. Then run:
   ```bash
   npm install
   ```

3. **Set Up Environment Variables**:
   Create a `.env.local` file in the root directory and add the required environment variables. You can find the necessary keys in the code or documentation.

4. **Run the Development Server**:
   Start the development server with:
   ```bash
   npm run dev
   ```
   Open your browser and navigate to `http://localhost:3000`.

## Usage Instructions

- **Visit the Pages**: You can navigate between different pages using the navigation bar.
- **Interact with the Guestbook**: Leave a message in the guestbook section.
- **Explore the Blog**: Read the latest blog posts and leave comments if enabled.
- **Check Your Statistics**: View your coding statistics and other relevant data.
- **Hire Me**: If interested in hiring services, check the pricing section and select a plan that fits your needs.
- **Spotify Integration**: View your current Spotify track and top artists. Test. This is a test.

## Contributions

Feel free to contribute to this project by submitting feature requests or bug reports via GitHub Issues. For larger contributions, please fork the repository and open a pull request.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.# Kodchasan Project

The Kodchasan Project is a collection of font software designed to stimulate worldwide development of collaborative font projects. The fonts are licensed under the SIL Open Font License, Version 1.1, which allows for free use, modification, and distribution under specific conditions.

## Major Parts of the Code

1. **Font Files**: The repository contains various SVG and font files that are essential for rendering text in the Kodchasan typeface. These files include both original and modified versions of the font.

2. **SVG Graphics**: The code includes SVG graphics that provide visual representations of the font, showcasing its design and versatility.

3. **License Information**: The repository contains the SIL Open Font License, which outlines the permissions and conditions for using the font software.

## Installation Instructions

To use the Kodchasan font in your project, follow these steps:

1. **Download the Font**: Clone or download the repository to your local machine.
   ```bash
   git clone https://github.com/cadsondemak/Kodchasan.git
   ```

2. **Install the Font**: Locate the font files (usually in `.ttf` or `.otf` format) in the downloaded directory. Install the font on your system by following the appropriate method for your operating system:
   - **Windows**: Right-click the font file and select "Install".
   - **Mac**: Double-click the font file and click "Install Font".
   - **Linux**: Copy the font file to `~/.fonts` or `/usr/share/fonts`, then run `fc-cache -fv`.

3. **Include the Font in Your Project**: Reference the font in your CSS or design software. For example, in CSS:
   ```css
   @font-face {
       font-family: 'Kodchasan';
       src: url('path/to/font/Kodchasan.ttf') format('truetype');
   }
   ```

## Usage Instructions

Once the font is installed, you can use it in your applications or projects:

- **Web Usage**: Include the font in your CSS stylesheets:
   ```css
   body {
       font-family: 'Kodchasan', sans-serif;
   }
   ```

- **Graphic Design**: Use the font in graphic design software like Adobe Illustrator, Photoshop, or any other design tools that support custom fonts.

- **Text Rendering**: Utilize the SVG files for custom text rendering in web applications or as part of graphic designs.

## License

The Kodchasan font software is licensed under the SIL Open Font License, Version 1.1. You can use, study, modify, and distribute the font as long as you adhere to the license conditions. For the detailed license, please refer to the `LICENSE` file in this repository.

---

For any additional questions or contributions, please refer to the project page on GitHub or contact the authors. Enjoy using the Kodchasan font!# README.md

## Overview

This repository contains Font Software and configuration files for integrating web applications with Microsoft browsers. The Font Software is distributed under a specific license, and the provided XML configuration is designed for browser compatibility, particularly with Microsoft’s tile interface.

## License Summary

The Font Software is subject to the following terms:

1. **Distribution**: The Font Software must be distributed entirely under this license and cannot be distributed under any other license.
2. **Termination**: The license becomes null and void if any of the conditions are not met.
3. **Disclaimer**: The Font Software is provided "as is" without any warranty. The copyright holder is not liable for any damages resulting from the use or inability to use the Font Software.

## Configuration File

The XML configuration file (`browserconfig.xml`) consists of the following major components:

- **Tile Configuration**: Specifies different tile sizes for Windows, including:
  - `square70x70logo`: Icon for small tiles.
  - `square150x150logo`: Icon for medium tiles.
  - `square310x310logo`: Icon for large tiles.
- **Tile Color**: The background color of the tile, specified as `#d6b3f0`.

## Installation Instructions

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-username/repo-name.git
   cd repo-name
   ```

2. **Install Dependencies**: If there are any dependencies, ensure they are installed. For example, if you're using Node.js, you might need to run:
   ```bash
   npm install
   ```

3. **Add Font Files**: Ensure that the font files are included in the directory as specified by the license.

## Usage Instructions

1. **Integrate Font Software**: Include the font files in your web project and reference them in your CSS.
   ```css
   @font-face {
       font-family: 'YourFontName';
       src: url('./path-to-font/font-file.woff2') format('woff2');
       font-weight: normal;
       font-style: normal;
   }
   ```

2. **Configure Browser Settings**: Add the `browserconfig.xml` file to the root of your web application. Ensure it is properly linked in your HTML files, typically in the `<head>` section:
   ```html
   <meta name="msapplication-config" content="browserconfig.xml">
   ```

3. **Test in Microsoft Browsers**: Open your web application in Microsoft browsers to ensure the tile icons and colors are rendered correctly.

## Conclusion

Follow the above instructions to effectively use the Font Software and configure your web application for optimal performance in Microsoft browsers. Ensure compliance with the licensing terms when distributing your application.
