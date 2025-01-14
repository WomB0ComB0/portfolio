# Project Name

## Overview
This project is a web application built with Next.js that includes various features such as Firebase integration, a guestbook component, a blog, a statistics dashboard, and Google Maps functionality. It leverages modern technologies and libraries like React, Tailwind CSS, and various GitHub actions for continuous integration and deployment.

## Major Components
1. **Guestbook**: Users can leave messages in the guestbook, which is powered by a serverless API to manage message storage.
2. **Blog**: A section for displaying blog posts fetched from an external API.
3. **Statistics Dashboard**: Displays personal statistics, including hours coded and site views.
4. **Google Maps Integration**: Shows locations that the user has visited, with marker clustering for better visualization.
5. **Firebase Authentication**: Allows users to sign in using various methods (Google, GitHub, anonymous).
6. **Playwright Tests**: Automated tests to ensure the application functions as expected.
7. **CI/CD with GitHub Actions**: Includes workflows for linting, testing, and deploying the application.

## Installation
To set up the project locally, follow these instructions:

### Prerequisites
- Node.js (version 14 or higher)
- npm (Node Package Manager)
- A Firebase account and project set up with the necessary configurations.

### Steps
1. **Clone the Repository**
   ```bash
   git clone https://github.com/WomB0ComB0/project-name.git
   cd project-name
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Set Up Environment Variables**
   Create a `.env.local` file in the root directory of the project and add the following variables:
   ```plaintext
   NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   ```

4. **Run the Development Server**
   ```bash
   npm run dev
   ```
   Open your browser and navigate to `http://localhost:3000` to view the application.

## Usage
- **Navigating the Application**: Use the navigation bar to switch between different sections such as the guestbook, blog, stats dashboard, and map.
- **Interacting with Components**: Users can leave messages in the guestbook, read blog posts, and view their coding statistics. The Google Maps section allows users to click on markers to view more information about each location.

## Contributing
If you'd like to contribute to this project, please fork the repository and submit a pull request with your changes.

## License
This project is licensed under the MIT License. See the LICENSE file for more information.

## Acknowledgments
- [Next.js](https://nextjs.org/)
- [Firebase](https://firebase.google.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Playwright](https://playwright.dev/) for testing
- [GitHub Actions](https://docs.github.com/en/actions) for CI/CD

For any further questions or issues, please feel free to open an issue in the GitHub repository.# Kodchasan Font Project

## Overview

Kodchasan is a typeface designed for various applications, inspired by traditional typography. This repository contains the source files and documentation for the Kodchasan font, which is licensed under the SIL Open Font License, Version 1.1.

## Major Components

The repository includes:

- **SVG Files**: Scalable Vector Graphics files representing the font glyphs and designs.
- **Font Files**: The actual font files for use in applications.
- **License File**: Details regarding the licensing and usage rights of the font.

## Installation

To install the Kodchasan font on your system, follow these steps:

### For Windows

1. Download the font files from the repository.
2. Right-click on the downloaded font file(s) and select "Install" to install the font on your system.

### For macOS

1. Download the font files from the repository.
2. Double-click on the downloaded font file(s) to open them in Font Book.
3. Click "Install Font" to add the font to your system.

### For Linux

1. Download the font files from the repository.
2. Copy the font files to `~/.fonts` directory (create it if it doesn’t exist).
3. Run `fc-cache -fv` in the terminal to refresh the font cache.

## Usage

Once installed, you can use the Kodchasan font in any application that allows you to select fonts, such as word processors, graphic design software, and web design.

### Example in CSS

To use the Kodchasan font on a website, add the following CSS to your stylesheet:

```css
@font-face {
    font-family: 'Kodchasan';
    src: url('path/to/kodchasan.woff2') format('woff2'),
         url('path/to/kodchasan.woff') format('woff');
    font-weight: normal;
    font-style: normal;
}

body {
    font-family: 'Kodchasan', sans-serif;
}
```

Make sure to replace `'path/to/kodchasan.woff2'` and `'path/to/kodchasan.woff'` with the actual paths to the font files.

## License

Kodchasan Font Software is licensed under the SIL Open Font License, Version 1.1. You can read the full license [here](https://openfontlicense.org).

## Contributing

If you would like to contribute to the Kodchasan project, feel free to fork the repository and submit a pull request. Your contributions and feedback are welcome!

## Contact

For any inquiries or issues, please contact the project maintainers through the GitHub repository.

---

This README provides a comprehensive guide to understanding, installing, and using the Kodchasan font. Thank you for your interest in the project!# Project Name

## Overview

This project is centered around a Font Software License and includes a browser configuration XML file. The license outlines the terms under which the font software can be used, distributed, and the limitations of liability associated with it. 

## License Summary

The font software provided in this project must be distributed under the specified license terms. Key points include:

- **Distribution**: The font must be distributed entirely under this license and cannot be distributed under any other license.
- **Termination**: The license is void if any of the conditions are not met.
- **Disclaimer**: The font software is provided "as is" without any warranty. The copyright holder is not liable for any damages arising from the use or inability to use the font software.

## Browser Configuration

The XML configuration file (`browserconfig.xml`) is designed to be used with Microsoft applications, specifying the application tile configurations for different sizes. The key elements in the XML include:

- **Tile Logos**: Paths to images of various sizes (`70x70`, `150x150`, and `310x310`).
- **Tile Color**: The color of the tile defined in hexadecimal format (`#d6b3f0`).

## Installation Instructions

To use the font software and the browser configuration, follow these steps:

1. **Download the Repository**: Clone or download this repository to your local machine.

   ```bash
   git clone https://github.com/username/project-name.git
   ```

2. **Install Fonts**:
   - Locate the font files within the repository.
   - Follow the instructions for your operating system to install the fonts:
     - **Windows**: Right-click the font file and select "Install".
     - **macOS**: Double-click the font file and click "Install Font".
     - **Linux**: Copy the font files to `~/.fonts` or `/usr/share/fonts`, then update the font cache using `fc-cache -f -v`.

3. **Configure Your Application**:
   - Place the `browserconfig.xml` file in the root directory of your web project.
   - Ensure the image paths specified in the XML file are correct and that the images are accessible.

## Usage Instructions

- **Using the Fonts**: After installation, you can use the fonts in your projects by specifying them in your CSS files. For example:

   ```css
   @font-face {
       font-family: 'YourFont';
       src: url('path/to/yourfont.woff2') format('woff2'),
            url('path/to/yourfont.woff') format('woff');
       font-weight: normal;
       font-style: normal;
   }

   body {
       font-family: 'YourFont', sans-serif;
   }
   ```

- **Using the Browser Configuration**: The `browserconfig.xml` should be linked in the `<head>` section of your HTML files for Microsoft browsers to recognize it:

   ```html
   <meta name="msapplication-config" content="browserconfig.xml" />
   ```

## Conclusion

This project provides a comprehensive Font Software License and a browser configuration file that helps streamline the use of custom fonts in web applications. Follow the installation and usage instructions to integrate the fonts effectively into your projects.