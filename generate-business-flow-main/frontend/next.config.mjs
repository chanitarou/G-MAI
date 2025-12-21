const nextConfig = {
    reactStrictMode: true,
    output: 'export',
    // 静的配信で /about -> /about/index.html などに解決させるため末尾スラッシュを付与
    trailingSlash: true,
    images: {
        unoptimized: true,
    },
};

export default nextConfig;
