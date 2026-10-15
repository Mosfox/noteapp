# Notes App — ระบบจดบันทึกส่วนตัว

เว็บแอปพลิเคชันขนาดเล็กสำหรับฝึกพัฒนา Frontend, Backend และการเชื่อมต่อฐานข้อมูล MongoDB

## ความสามารถ

- สมัครสมาชิก เข้าสู่ระบบ และออกจากระบบ
- สร้าง อ่าน แก้ไข และลบโน้ต (CRUD)
- ค้นหาโน้ตตามข้อความ และกรองตามหมวดหมู่
- ปักหมุดโน้ต
- จัดรูปแบบข้อความ แนบรูปภาพ และเพิ่ม Checklist
- เก็บผู้ใช้ โน้ต และ session ใน MongoDB
- แยกสิทธิ์ `member` และ `admin`
- ผู้ดูแลระบบสามารถดูและลบบัญชีสมาชิกได้

## เทคโนโลยี

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- Database: MongoDB
- Password hashing: bcryptjs

## โครงสร้างโฟลเดอร์

```text
notes-app/
├── server/
│   ├── index.js
│   ├── db.js
│   ├── middleware/auth.js
│   └── routes/
│       ├── auth.js
│       ├── notes.js
│       └── users.js
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── docs/
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## สิ่งที่ต้องติดตั้งก่อน

1. ติดตั้ง Node.js รุ่นที่รองรับ `node --watch` (แนะนำ Node.js 20 ขึ้นไป)
2. ติดตั้งและเปิด MongoDB ในเครื่อง หรือเตรียม MongoDB connection string
3. เปิด Terminal ในโฟลเดอร์โปรเจกต์

## วิธีติดตั้ง


npm install
```

คัดลอก `.env.example` เป็น `.env` แล้วแก้ค่าตามเครื่องของตนเอง


Windows PowerShell:
```powershell
Copy-Item .env.example .env
```

ค่าตัวอย่างใน `.env`:

```env
PORT=3000
MONGO_URL=mongodb://127.0.0.1:27017
DB_NAME=notes-db
ADMIN_USERNAME=admin
ADMIN_NAME=Administrator
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=ChangeThisPassword123!
```

**สำคัญ:** เปลี่ยน `ADMIN_PASSWORD` เป็นรหัสผ่านที่คาดเดายากก่อนรัน และห้ามอัปโหลดไฟล์ `.env` ขึ้น GitHub

ถ้าไม่ต้องการสร้างบัญชี admin อัตโนมัติ ให้ลบหรือเว้นค่า `ADMIN_USERNAME` และ `ADMIN_PASSWORD` ไว้ ระบบสมัครสมาชิกทั่วไปจะสร้าง role เป็น `member`

## วิธีรัน

```bash
npm run dev
```

เปิดเบราว์เซอร์ที่ [http://localhost:3000](http://localhost:3000)

หยุดเซิร์ฟเวอร์ด้วย `Ctrl + C`

## API Endpoints

ทุก endpoint ที่ระบุว่า **ต้องเข้าสู่ระบบ** ต้องแนบ header:

```http
Authorization: Bearer <token>
```

### Health check

| Method | Endpoint | รายละเอียด | Auth |
|---|---|---|---|
| GET | `/api/health` | ตรวจสอบว่าเซิร์ฟเวอร์ทำงาน | ไม่ต้อง |

### Authentication

| Method | Endpoint | รายละเอียด | Auth |
|---|---|---|---|
| POST | `/api/register` | สมัครสมาชิก | ไม่ต้อง |
| POST | `/api/login` | เข้าสู่ระบบและรับ token | ไม่ต้อง |
| POST | `/api/logout` | ออกจากระบบและยกเลิก session | ต้องเข้าสู่ระบบ |
| GET | `/api/me` | ดูข้อมูลบัญชีที่เข้าสู่ระบบ | ต้องเข้าสู่ระบบ |

ตัวอย่าง body สำหรับ `POST /api/register`:

```json
{
  "username": "student01",
  "name": "Student",
  "email": "student@example.com",
  "password": "MyPassword123"
}
```

ตัวอย่าง body สำหรับ `POST /api/login`:

```json
{
  "username": "student01",
  "password": "MyPassword123"
}
```

### Notes

| Method | Endpoint | รายละเอียด | Auth |
|---|---|---|---|
| GET | `/api/notes` | ดูโน้ตทั้งหมดของผู้ใช้ | ต้องเข้าสู่ระบบ |
| GET | `/api/notes?q=คำค้น` | ค้นหาโน้ต | ต้องเข้าสู่ระบบ |
| GET | `/api/notes?category=เรียน` | กรองตามหมวดหมู่ | ต้องเข้าสู่ระบบ |
| GET | `/api/notes?pinned=true` | ดูเฉพาะโน้ตที่ปักหมุด | ต้องเข้าสู่ระบบ |
| GET | `/api/notes/:id` | ดูโน้ตตาม ID | ต้องเข้าสู่ระบบ |
| POST | `/api/notes` | สร้างโน้ต | ต้องเข้าสู่ระบบ |
| PATCH | `/api/notes/:id` | แก้ไขโน้ต | ต้องเข้าสู่ระบบ |
| DELETE | `/api/notes/:id` | ลบโน้ต | ต้องเข้าสู่ระบบ |
| GET | `/api/categories` | ดูหมวดหมู่และจำนวนโน้ต | ต้องเข้าสู่ระบบ |

ตัวอย่าง body สำหรับสร้างโน้ต:

```json
{
  "title": "งานวิชา Web Programming",
  "category": "เรียน",
  "content": "<p>ทำโปรเจกต์ Notes App</p>",
  "pinned": false,
  "images": [],
  "checklist": [
    { "id": "task1", "text": "ทำหน้าเว็บ", "done": false },
    { "id": "task2", "text": "เชื่อมฐานข้อมูล", "done": true }
  ]
}
```

### Users (Admin only)

| Method | Endpoint | รายละเอียด | Auth |
|---|---|---|---|
| GET | `/api/users` | ดูรายชื่อสมาชิก | ต้องเข้าสู่ระบบและเป็น admin |
| DELETE | `/api/users/:username` | ลบบัญชีสมาชิกและโน้ตของสมาชิก | ต้องเข้าสู่ระบบและเป็น admin |

## ฐานข้อมูล

แอปใช้ฐานข้อมูลชื่อ `notes-db` โดยมี collection หลัก:

- `users`: ข้อมูลผู้ใช้และ password hash
- `sessions`: token สำหรับ session และเวลาหมดอายุ
- `notes`: โน้ต หมวดหมู่ รูปภาพ และ checklist

รหัสผ่านจะถูก hash ด้วย bcryptjs ก่อนเก็บในฐานข้อมูล

## ภาพหลักฐานการดีบัก

หลังทดสอบโปรแกรมจริง ให้บันทึกภาพหน้าจอ 2 ภาพลงในโฟลเดอร์ `docs/` แล้วตั้งชื่อดังนี้:

1. `docs/debug-register.png` — ภาพการสมัครสมาชิกสำเร็จ หรือข้อมูลผู้ใช้ที่ถูกสร้างใน MongoDB
2. `docs/debug-notes.png` — ภาพการสร้าง/แสดงโน้ต และหลักฐานข้อมูลใน MongoDB หรือผลตอบกลับจาก API




### ภาพที่ 1: ทดสอบสมัครสมาชิก
![Register debugging evidence](docs/debug-register.png)
![Register debugging evidence](docs/debug-register1.png)
### ภาพที่ 2: ทดสอบบันทึกโน้ต
![Notes debugging evidence](docs/debug-notes.png)
![Notes debugging evidence](docs/debug-notes1.png)

