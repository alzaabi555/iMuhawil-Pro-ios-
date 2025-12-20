import flet as ft
import openpyxl
import csv
import datetime

# --- إعدادات ثابتة ---
POSITIVE_BEHAVIORS = ["مشاركة فعالة", "حل الواجب", "احترام المعلم", "نظافة", "تعاون", "إجابة ذكية"]
NEGATIVE_BEHAVIORS = ["إزعاج", "نسيان الكتاب", "تأخر", "نوم في الحصة", "استخدام الهاتف", "شغب"]

class SchoolApp:
    def __init__(self):
        self.school_data = {}
        self.current_class = ""
        self.selected_date = datetime.date.today().strftime("%Y-%m-%d")

    def main(self, page: ft.Page):
        page.title = "نظام المتابعة المدرسي"
        page.rtl = True
        page.theme_mode = ft.ThemeMode.LIGHT
        page.scroll = None 
        page.bgcolor = "#f5f5f7"

        # --- إدارة البيانات ---
        def load_data():
            try:
                data = page.client_storage.get("school_db_v5")
                if isinstance(data, dict):
                    self.school_data = data
                else:
                    self.school_data = {}
            except:
                self.school_data = {}

        def save_data():
            page.client_storage.set("school_db_v5", self.school_data)

        load_data()

        # --- عناصر الواجهة المشتركة ---
        txt_class_name = ft.TextField(hint_text="اسم الفصل", bgcolor="white", border_radius=10, expand=True)
        txt_student_name = ft.TextField(hint_text="اسم الطالب", bgcolor="white", border_radius=10, expand=True)
        
        # منتقي التاريخ
        date_picker = ft.DatePicker(
            first_date=datetime.datetime(2023, 10, 1),
            last_date=datetime.datetime(2030, 10, 1),
            on_change=lambda e: change_date(e)
        )
        page.overlay.append(date_picker)
        
        date_button = ft.ElevatedButton(
            text=f"تاريخ اليوم: {self.selected_date}",
            icon=ft.icons.CALENDAR_MONTH,
            bgcolor="blue", color="white",
            on_click=lambda _: date_picker.pick_date()
        )

        def change_date(e):
            if date_picker.value:
                self.selected_date = date_picker.value.strftime("%Y-%m-%d")
                date_button.text = f"التاريخ: {self.selected_date}"
                if self.current_class:
                    show_students_view(None) # تحديث العرض
                page.update()

        # --- دالة الاستيراد (حل مشكلة الرموز) ---
        file_picker = ft.FilePicker()
        page.overlay.append(file_picker)

        def on_file_picked(e: ft.FilePickerResultEvent):
            if not e.files or not self.current_class: return
            try:
                file_path = e.files[0].path
                raw_rows = []
                
                if e.files[0].name.endswith('.csv'):
                    # محاولة قراءة ذكية للترميز العربي
                    try:
                        with open(file_path, 'r', encoding='utf-8-sig') as f:
                            raw_rows = list(csv.reader(f))
                    except UnicodeDecodeError:
                        try:
                            with open(file_path, 'r', encoding='cp1256') as f:
                                raw_rows = list(csv.reader(f))
                        except:
                            page.snack_bar = ft.SnackBar(ft.Text("فشل في قراءة ترميز الملف"), bgcolor="red")
                            page.snack_bar.open = True
                            page.update()
                            return
                elif e.files[0].name.endswith(('xlsx', 'xls')):
                    wb = openpyxl.load_workbook(file_path, data_only=True)
                    sheet = wb.active
                    for row in sheet.iter_rows(values_only=True):
                        raw_rows.append([str(c) if c else "" for c in row])

                count = 0
                current_students = self.school_data[self.current_class]
                existing_names = {s['name'] for s in current_students}

                for row in raw_rows:
                    for cell in row:
                        val = str(cell).strip()
                        # تنظيف النص
                        val = "".join([c for c in val if c.isalnum() or c.isspace()])
                        
                        if len(val) > 2 and not val.isdigit() and "اسم" not in val:
                            if val not in existing_names:
                                # هيكل بيانات الطالب الجديد (يدعم التواريخ)
                                current_students.append({
                                    "name": val, 
                                    "score": 0, 
                                    "history": [], # قائمة للسلوكيات {date, type, note}
                                    "attendance": {} # قاموس للغياب {date: status}
                                })
                                existing_names.add(val)
                                count += 1
                
                save_data()
                show_students_view(None)
                page.snack_bar = ft.SnackBar(ft.Text(f"تم استيراد {count} اسم"), bgcolor="green")
                page.snack_bar.open = True
                page.update()

            except Exception as ex:
                page.snack_bar = ft.SnackBar(ft.Text(f"خطأ: {ex}"), bgcolor="red")
                page.snack_bar.open = True
                page.update()

        file_picker.on_result = on_file_picked

        # --- صفحة تفاصيل الطالب (الإحصائيات) ---
        def show_student_details(student, class_name):
            
            # حساب الإحصائيات
            attendance_log = student.get('attendance', {})
            absent_days = [d for d, status in attendance_log.items() if status == 'absent']
            history = student.get('history', [])
            
            # تبويب السلوكيات
            behavior_list = ft.ListView(expand=True, spacing=5)
            if not history:
                behavior_list.controls.append(ft.Text("لا يوجد سجل سلوكيات", color="grey"))
            else:
                for record in reversed(history): # الأحدث أولاً
                    icon = ft.icons.THUMB_UP if record['type'] == 'pos' else ft.icons.THUMB_DOWN
                    color = "green" if record['type'] == 'pos' else "red"
                    behavior_list.controls.append(
                        ft.ListTile(
                            leading=ft.Icon(icon, color=color),
                            title=ft.Text(record['note'], weight="bold"),
                            subtitle=ft.Text(record['date'], size=12, color="grey")
                        )
                    )

            # تبويب الغياب
            absent_list = ft.ListView(expand=True, spacing=5)
            if not absent_days:
                absent_list.controls.append(ft.Text("الطالب منتظم في الحضور", color="green"))
            else:
                for day in sorted(absent_days, reverse=True):
                    absent_list.controls.append(
                        ft.ListTile(
                            leading=ft.Icon(ft.icons.Event_BUSY, color="red"),
                            title=ft.Text(f"غائب يوم: {day}")
                        )
                    )

            # نافذة العرض
            page.views.append(
                ft.View(
                    "/student_details",
                    [
                        ft.AppBar(
                            title=ft.Text(student['name']), 
                            bgcolor="indigo", color="white",
                            leading=ft.IconButton(ft.icons.ARROW_BACK, on_click=lambda _: page.pop())
                        ),
                        ft.Container(
                            padding=20,
                            content=ft.Row([
                                ft.Column([
                                    ft.Text("مجموع النقاط", color="grey"),
                                    ft.Text(str(student['score']), size=30, weight="bold", color="blue")
                                ], alignment=ft.MainAxisAlignment.CENTER),
                                ft.Container(width=20),
                                ft.Column([
                                    ft.Text("أيام الغياب", color="grey"),
                                    ft.Text(str(len(absent_days)), size=30, weight="bold", color="red")
                                ], alignment=ft.MainAxisAlignment.CENTER),
                            ], alignment=ft.MainAxisAlignment.CENTER)
                        ),
                        ft.Tabs(
                            selected_index=0,
                            tabs=[
                                ft.Tab(text="سجل السلوك", content=ft.Container(content=behavior_list, padding=10)),
                                ft.Tab(text="سجل الغياب", content=ft.Container(content=absent_list, padding=10)),
                            ],
                            expand=True
                        )
                    ],
                    bgcolor="white"
                )
            )
            page.update()

        # --- التنقل (Router) ---
        def route_change(route):
            page.views.clear()
            
            # --- الصفحة الرئيسية ---
            if page.route == "/":
                def add_class(e):
                    if txt_class_name.value and txt_class_name.value not in self.school_data:
                        self.school_data[txt_class_name.value] = []
                        save_data()
                        txt_class_name.value = ""
                        route_change(None)

                def go_to_class(name):
                    self.current_class = name
                    page.go("/class")
                
                def delete_class(name):
                    del self.school_data[name]
                    save_data()
                    route_change(None)
                
                def clear_all(e):
                    self.school_data = {}
                    save_data()
                    route_change(None)

                classes_list = ft.ListView(expand=True, spacing=10, padding=15)
                for name in self.school_data:
                    count = len(self.school_data[name])
                    classes_list.controls.append(
                        ft.Card(
                            elevation=2,
                            content=ft.ListTile(
                                leading=ft.Icon(ft.icons.CLASS_, color="indigo"),
                                title=ft.Text(name, weight="bold"),
                                subtitle=ft.Text(f"{count} طالب"),
                                trailing=ft.IconButton(ft.icons.DELETE, icon_color="red", on_click=lambda e, n=name: delete_class(n)),
                                on_click=lambda e, n=name: go_to_class(n)
                            )
                        )
                    )

                page.views.append(
                    ft.View("/", [
                        ft.AppBar(title=ft.Text("الفصول"), bgcolor="indigo", color="white", 
                                  actions=[ft.IconButton(ft.icons.DELETE_FOREVER, tooltip="تصفير الكل", on_click=clear_all)]),
                        ft.Container(padding=10, bgcolor="white", content=ft.Row([txt_class_name, ft.FloatingActionButton(icon=ft.icons.ADD, on_click=add_class)])),
                        classes_list
                    ], bgcolor="#f2f2f7")
                )

            # --- صفحة الفصل (الطلاب) ---
            elif page.route == "/class":
                students = self.school_data.get(self.current_class, [])

                def add_student(e):
                    if txt_student_name.value:
                        students.append({"name": txt_student_name.value, "score": 0, "history": [], "attendance": {}})
                        save_data()
                        txt_student_name.value = ""
                        show_students_view(None)

                # تسجيل الحضور/الغياب للتاريخ المحدد
                def toggle_attendance(student):
                    att = student.get('attendance', {})
                    current_status = att.get(self.selected_date, "present")
                    new_status = "absent" if current_status == "present" else "present"
                    att[self.selected_date] = new_status
                    student['attendance'] = att
                    save_data()
                    show_students_view(None)

                # إضافة سلوك
                def add_behavior(student, behavior_type, note):
                    if 'history' not in student: student['history'] = []
                    
                    student['history'].append({
                        "date": self.selected_date,
                        "type": behavior_type,
                        "note": note
                    })
                    
                    # تحديث النقاط
                    if behavior_type == 'pos': student['score'] += 1
                    else: student['score'] -= 1
                    
                    save_data()
                    page.close_dialog()
                    show_students_view(None)

                def open_behavior_dialog(student):
                    pos_col = ft.Column([ft.ListTile(title=ft.Text(b), leading=ft.Icon(ft.icons.ADD_CIRCLE, color="green"), on_click=lambda e, n=b: add_behavior(student, 'pos', n)) for b in POSITIVE_BEHAVIORS])
                    neg_col = ft.Column([ft.ListTile(title=ft.Text(b), leading=ft.Icon(ft.icons.REMOVE_CIRCLE, color="red"), on_click=lambda e, n=b: add_behavior(student, 'neg', n)) for b in NEGATIVE_BEHAVIORS])
                    
                    tabs = ft.Tabs(selected_index=0, tabs=[
                        ft.Tab(text="إيجابي", content=ft.Container(content=pos_col, height=300)),
                        ft.Tab(text="سلبي", content=ft.Container(content=neg_col, height=300))
                    ])
                    
                    page.dialog = ft.AlertDialog(title=ft.Text(student['name']), content=ft.Container(width=300, content=tabs))
                    page.dialog.open = True
                    page.update()

                students_lv = ft.ListView(expand=True, spacing=5, padding=10)
                
                for s in students:
                    # التحقق من الحالة في التاريخ المحدد
                    att_record = s.get('attendance', {})
                    is_absent = att_record.get(self.selected_date) == "absent"
                    
                    bg_color = "#ffebee" if is_absent else "white"
                    att_icon = ft.icons.CANCEL if is_absent else ft.icons.CHECK_CIRCLE
                    att_color = "red" if is_absent else "green"

                    students_lv.controls.append(
                        ft.Card(
                            color=bg_color,
                            elevation=0.5,
                            content=ft.ListTile(
                                leading=ft.IconButton(
                                    icon=att_icon, icon_color=att_color,
                                    tooltip="غياب/حضور",
                                    on_click=lambda e, stu=s: toggle_attendance(stu)
                                ),
                                title=ft.Text(s['name'], weight="bold"),
                                subtitle=ft.Text(f"النقاط: {s['score']}", color="blue"),
                                trailing=ft.IconButton(ft.icons.ADD_COMMENT, icon_color="orange", tooltip="إضافة سلوك", on_click=lambda e, stu=s: open_behavior_dialog(stu)),
                                on_click=lambda e, stu=s: show_student_details(stu, self.current_class)
                            )
                        )
                    )

                page.views.append(
                    ft.View("/class", [
                        ft.AppBar(
                            title=ft.Text(self.current_class), bgcolor="indigo", color="white",
                            leading=ft.IconButton(ft.icons.ARROW_BACK, on_click=lambda _: page.go("/")),
                            actions=[ft.IconButton(ft.icons.UPLOAD_FILE, on_click=lambda _: file_picker.pick_files())]
                        ),
                        ft.Container(padding=10, bgcolor="white", content=ft.Column([
                            date_button, # زر التاريخ
                            ft.Row([txt_student_name, ft.FloatingActionButton(icon=ft.icons.PERSON_ADD, bgcolor="green", on_click=add_student)])
                        ])),
                        students_lv
                    ], bgcolor="#f2f2f7")
                )
            
            page.update()

        def show_students_view(_):
            route_change(None)

        page.on_route_change = route_change
        page.go("/")

if __name__ == "__main__":
    app = SchoolApp()
    ft.app(target=app.main)
