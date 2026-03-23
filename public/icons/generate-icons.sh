#!/bin/bash
# Generate PWA icons from a source image
# Usage: ./generate-icons.sh source-image.png

# Create placeholder SVG icons (replace with actual logo later)
cat > icon-192x192.svg << 'SVG'
<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
  <rect width="192" height="192" rx="24" fill="#7c3aed"/>
  <text x="96" y="110" font-size="80" text-anchor="middle" fill="white">🎬</text>
</svg>
SVG

echo "Replace these placeholder SVGs with actual PNG icons"
echo "Required sizes: 192x192, 512x512"
