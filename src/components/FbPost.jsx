import { useEffect, useRef } from "react";
import useFacebookSDK from "../hooks/useFacebookSDK";

export default function FbPost({ url, height = 260 }) {
  const boxRef = useRef(null);
  const ready = useFacebookSDK();

  useEffect(() => {
    if (ready && window.FB && boxRef.current) window.FB.XFBML.parse(boxRef.current);
  }, [ready, url]);

  if (!url) return null;

  return (
    <div ref={boxRef} className="w-full">
      {/* data-width để trống: SDK sẽ tự fit theo container */}
      <div className="fb-post" data-href={url} data-show-text="true" />
      {!ready && <div className="w-full rounded-xl bg-gray-100 animate-pulse" style={{ minHeight: height }} />}
    </div>
  );
}
