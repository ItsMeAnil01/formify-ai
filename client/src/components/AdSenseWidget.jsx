import { useEffect } from "react";

const AdSenseWidget = ({ slot }) => {
  useEffect(() => {
    // Verify adsbygoogle is available before pushing
    try {
      if (typeof window !== "undefined") {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch (err) {
      console.warn("AdSense push failed:", err);
    }
  }, []);

  const client = import.meta.env.VITE_ADSENSE_CLIENT_ID;

  // Render a placeholder in development mode if no client ID is set
  if (!client) {
    return (
      <div className="my-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-ink/10 bg-ink/3 p-6 text-center text-xs text-ink/40">
        <span className="text-base mb-1">📢 AdSense Space</span>
        <p>Configure VITE_ADSENSE_CLIENT_ID in client/.env to load Google ads</p>
      </div>
    );
  }

  return (
    <div className="my-6 flex justify-center overflow-hidden w-full">
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={slot || "default"}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
};

export default AdSenseWidget;
