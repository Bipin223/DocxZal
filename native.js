/* Android bridge: save exports through the system share sheet.
   On the web this file is inert, so normal browser downloads still work. */
(function () {
  function native() {
    return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform());
  }
  function toBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",", 2)[1] || "");
      reader.onerror = () => reject(reader.error || new Error("Could not read file"));
      reader.readAsDataURL(blob);
    });
  }
  async function saveBlob(blob, filename) {
    if (!native()) return false;
    const plugins = window.Capacitor.Plugins || {};
    const Filesystem = plugins.Filesystem, Share = plugins.Share;
    if (!Filesystem || !Share) throw new Error("Native file plugins are unavailable");
    const data = await toBase64(blob);
    const file = await Filesystem.writeFile({
      path: filename,
      data,
      directory: "CACHE",
      recursive: true
    });
    await Share.share({
      title: filename,
      text: "Docxzal export",
      url: file.uri,
      dialogTitle: "Save or share " + filename
    });
    return true;
  }
  window.docxzalNative = { isNative: native, saveBlob };
})();
