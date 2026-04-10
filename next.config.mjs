/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Required for @supabase/ssr cookie handling in middleware
    serverComponentsExternalPackages: ['html5-qrcode'],
  },
  // Allow data: URIs for inline QR base64 images
  images: {
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
  },
};

export default nextConfig;
