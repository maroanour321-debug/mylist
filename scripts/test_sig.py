# اختبار توافق البصمة: بايثون يحسب work_signature بنفس خوارزمية البرنامج الأصلي
import hashlib, json, sys
sys.path.insert(0, "/home/z/my-project/upload/MyList_V9_extracted/MyList")
import core

w = core.normalize_work({
    "title": "مسلسل تجريبي", "type": "series", "category": "مسلسل", "year": "2024",
    "seasons": [{"number": 1, "episodes": [
        {"number": 1, "title": "", "servers": [{"name": "VIP", "url": "https://ok.ru/video/123456"}]},
        {"number": 2, "title": "حلقة خاصة", "servers": []},
    ]}],
})
sig = core.work_signature(w)
print("PY_SIG=" + sig)
print("PY_JSON=" + json.dumps({"sig": sig}))
