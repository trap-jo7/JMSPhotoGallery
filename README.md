# JMS Photo Gallery

An interactive photo gallery built with React, Vite, and Tailwind CSS. Browse photos in a swipeable card deck, switch between albums, and add your own pictures.

**Live site:** https://trap-jo7.github.io/JMSPhotoGallery/

## Features

- Slide through photos with the slider, arrow keys, or by clicking a card
- Separate albums (Outdoors and City) on one shared slider
- Click the center photo to view it full screen
- Add photos with the + button or by dragging images onto the page
- Add or edit a caption on any photo
- Delete the current photo with the trash button
- Background color adapts to each photo
- Light and dark mode follow your device settings

## Saving photos

Photos you upload are saved in your own browser (using IndexedDB), so they are still there when you reload the page. They are only stored on that device and browser. Other visitors will not see them, and clearing your browser data will remove them.

To add photos that everyone can see, put the image files in `public/assets` and add them to the `initialAlbums` list at the top of `src/App.tsx`.

## Built with

- React 19
- Vite
- Tailwind CSS 4
- TypeScript

## Deployment

The site is deployed to GitHub Pages automatically by GitHub Actions. Every push to the `main` branch rebuilds and publishes it. The workflow is in `.github/workflows/deploy.yml`.

## Project structure

- `src/App.tsx` - the main gallery component
- `src/main.tsx` - app entry point
- `src/index.css` - global styles
- `public/assets` - built-in photos
- `vite.config.ts` - build configuration
