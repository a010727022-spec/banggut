/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Lint 경고성 규칙이 배포를 막지 않도록. CI/로컬 `npm run lint` 로 별도 확인.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
