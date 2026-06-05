window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.origin !== window.location.origin) return;

  const data = event.data;
  if (!data || data.source !== "archb-extension-connect" || !data.token) return;

  chrome.storage.local.set(
    {
      archbToken: data.token,
      archbBaseUrl: (data.siteUrl || window.location.origin).replace(/\/+$/, ""),
      archbTokenExpiresAt: data.expiresAt || "",
      archbUser: data.user || null,
    },
    () => {
      window.postMessage(
        {
          source: "archb-extension-connect-ack",
          success: true,
        },
        window.location.origin
      );
    }
  );
});
