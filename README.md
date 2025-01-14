# README

## Overview

This repository contains a web application built using Next.js, which includes various features such as a guestbook, a blog, music statistics from Spotify, and a dashboard displaying personal stats and Discord status. The application is designed with modern UI components and responsive design principles.

## Major Components

1. **Feature Requests and Bug Reports**: 
   - Templates for submitting feature requests and bug reports using GitHub Issues.

2. **GitHub Actions Workflows**:
   - **Next.js Bundle Analysis**: Automates the analysis of the Next.js bundle size and compares it against the base branch.
   - **CodeQL**: Configures security vulnerability scanning for the codebase.
   - **Playwright Tests**: Runs end-to-end tests on the application.
   - **Linting**: Checks the code for style and syntax errors using a linter.
   - **Release Management**: Manages the release process with Semantic Release.

3. **UI Components**: 
   - A collection of reusable UI components built with React and styled using Tailwind CSS, including buttons, cards, avatars, and more.

4. **Pages**:
   - **Dashboard**: Displays personal statistics and Discord status.
   - **Blog**: Showcases the latest blog posts.
   - **Guestbook**: Allows users to leave messages.
   - **Resume**: Provides a downloadable resume and an embedded Google Doc view.
   - **Hire Me**: Presents various service tiers for hiring.
   - **Links**: A collection of external links to social media and other platforms.
   - **Spotify Stats**: Displays the current playing track, top artists, and top tracks from Spotify.

5. **Google Maps Integration**: 
   - Displays a map with markers for various locations.

## Installation Instructions

To set up the project locally, follow these steps:

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/yourusername/your-repo.git
   cd your-repo
   ```

2. **Install Dependencies**:
   Ensure you have Node.js installed. Then run:
   ```bash
   npm install
   ```

3. **Set Up Environment Variables**:
   Create a `.env.local` file in the root directory and add the required environment variables. These variables may include API keys for Google Maps, Firebase, and other services used in the application.

4. **Run the Development Server**:
   Start the application in development mode:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser to view the application.

## Usage Instructions

- Navigate through the application using the links provided in the navigation bar.
- Use the guestbook feature to leave messages for others.
- View the blog section for updates and articles.
- Explore the dashboard to see personal statistics and Discord status.
- Check out the Spotify stats to view your current playing tracks and top artists.
- Use the hire me section to see the services offered and select a plan for hiring.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue for any suggestions or improvements.# Project Title

## Overview
This project contains a collection of SVG (Scalable Vector Graphics) images and font files licensed under the SIL Open Font License, Version 1.1. The primary purpose of this repository is to provide various graphical assets that can be utilized in web and software development.

## Major Components
1. **SVG Files**: The repository includes multiple SVG files which are vector graphics that can be scaled without losing quality. These files contain different shapes and designs.

2. **Font Files**: The project includes font files that adhere to the SIL Open Font License. These fonts can be used freely as long as they are not sold by themselves.

3. **License Information**: The project is licensed under the SIL Open Font License, allowing users to use, modify, and distribute the fonts and graphics as long as they follow the specified conditions.

## Installation Instructions
To use the SVG graphics and font files in your project, follow these steps:

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/yourusername/your-repo-name.git
   ```
2. **Navigate to the Project Directory**:
   ```bash
   cd your-repo-name
   ```

3. **Use the Assets**: 
   - For SVG files, you can directly link to them in your HTML:
     ```html
     <img src="path/to/svg-file.svg" alt="Description of SVG">
     ```
   - For font files, you can include them in your CSS:
     ```css
     @font-face {
         font-family: 'FontName';
         src: url('path/to/font-file.ttf') format('truetype');
     }
     ```

## Usage Instructions
1. **Including SVG Files**:
   - You can use SVG files in your HTML or CSS. Here are some examples:
     - **Inline SVG**:
       ```html
       <svg>
           <!-- SVG content here -->
       </svg>
       ```
     - **External SVG**:
       ```html
       <img src="path/to/svg-file.svg" alt="SVG Image">
       ```

2. **Using the Fonts**:
   - To apply the font in your CSS, use the font family name:
     ```css
     body {
         font-family: 'FontName', sans-serif;
     }
     ```

3. **Modifying SVG**:
   - SVG files can be edited using any text editor since they are XML-based. You can modify attributes like `fill`, `stroke`, and dimensions directly in the SVG code.

4. **Credits**:
   - If you use the fonts or graphics in your project, please acknowledge the original authors as per the license guidelines.

## License
This project is licensed under the [SIL Open Font License, Version 1.1](https://openfontlicense.org). Please refer to the license files for more detailed information regarding usage rights and restrictions.

## Conclusion
This repository provides a versatile set of SVG graphics and fonts that can enhance the visual aspect of your projects. By following the installation and usage instructions, you can easily integrate these assets into your applications.# Project Title

## Overview

This project includes a font software license and a browser configuration XML file. The font software is distributed under a specific license that outlines the terms of use, distribution, and warranty disclaimers. The browser configuration file is designed to set up custom tiles for Windows applications.

## License Summary

The font software must be distributed entirely under the specified license and cannot be combined with other licenses. Key points include:

- Fonts created using the software do not need to adhere to the same licensing terms.
- The license is void if any conditions are violated.
- The software is provided "AS IS" without any warranties, and the copyright holder is not liable for any damages arising from its use.

## Browser Configuration

The `browserconfig.xml` file is formatted in XML and includes configurations for Windows application tiles. The configuration defines:

- Different sizes for application tiles (70x70, 150x150, 310x310)
- A color for the tile background

### XML Structure

The XML file includes the following elements:

- `msapplication`: Main application settings
  - `tile`: Contains various tile logos and the background color
    - `square70x70logo`: Path to the 70x70 tile logo
    - `square150x150logo`: Path to the 150x150 tile logo
    - `square310x310logo`: Path to the 310x310 tile logo
    - `TileColor`: Background color for the tile

## Installation Instructions

1. **Clone the Repository**: 
   ```
   git clone https://github.com/username/repository.git
   cd repository
   ```

2. **Install Dependencies**: 
   *(If applicable, list any dependencies or installation steps needed for the font software or XML configurations.)*

3. **Add Font Files**: 
   Make sure to include the font files in the appropriate directory as per the licensing terms.

4. **Configure Browser Settings**: 
   Place the `browserconfig.xml` file in the root directory of your web project to ensure the browser can access it.

## Usage Instructions

- **Using the Font Software**: 
  Follow the licensing terms to use the font software in your projects. Ensure you distribute the fonts only under the specified license.

- **Implementing Browser Configuration**:
  Add a reference to the `browserconfig.xml` file in your HTML header to utilize the tile configurations:
  ```html
  <meta name="msapplication-config" content="browserconfig.xml">
  ```

- **Testing**: 
  After setting up the project and configuring the browser settings, test your application in different browsers to ensure the tile displays correctly.

## Conclusion

This project provides necessary configurations for font software and browser applications. Make sure to adhere to the licensing terms and properly implement the configurations for optimal use. For any further questions or contributions, please refer to the project's issue tracker.