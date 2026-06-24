// src/components/chat/ImageMessage.tsx
export function ImageMessage({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="image-message">
      <img
        src={src}
        alt={alt}
        className="rounded-lg max-w-md mt-2 border border-gray-200"
        loading="lazy"
        onError={(e) => {
          (e.target as HTMLImageElement).src = "/fallback-image.png";
        }}
      />
      <style>{`
        .image-message img {
          max-width: 100%;
          height: auto;
          display: block;
        }
      `}</style>
    </div>
  );
}