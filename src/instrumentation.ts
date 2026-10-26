// إصلاح الشبكة في بيئة الاستضافة: IPv4 مبينجحش دايماً للاتصالات الخارجية،
// فبنفعّل Happy Eyeballs (autoSelectFamily) عشان Node يجرب IPv6 و IPv4 مع بعض.
// زي انتخاب العايلة في المتصفح — بدون تأثير على أي حاجة تانية.
export async function register(): Promise<void> {
  // نتخطى في Edge Runtime لإن net مش متاح هناك
  if (typeof process === "undefined" || process.versions?.node == null) return;
  try {
    const net = await import("net");
    if (typeof net.setDefaultAutoSelectFamily === "function") {
      net.setDefaultAutoSelectFamily(true);
    }
    if (typeof net.setDefaultAutoSelectFamilyAttemptTimeout === "function") {
      net.setDefaultAutoSelectFamilyAttemptTimeout(1500);
    }
  } catch {
    // البيئة مش بتدعمه — بنكمل عادي
  }
}
