export default function BrandLogo({ className = 'brand-mark', alt = 'MiniTrello logo' }) {
  return (
    <img
      className={className}
      src="/minitrello-logo.png"
      alt={alt}
      draggable="false"
    />
  );
}
