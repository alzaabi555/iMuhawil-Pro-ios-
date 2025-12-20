import flet as ft
import openpyxl
import io
import csv
import base64

# --- قوائم السلوكيات الثابتة ---
POSITIVE_BEHAVIORS = [
    "مشاركة ممتازة", "حل الواجب", "احترام المعلم",
    "مساعدة الزملاء", "نظافة وأناقة", "إجابة ذكية"
]
NEGATIVE_BEHAVIORS = [
    "عدم حل الواجب", "كثرة الكلام", "تأخر صباحي",
    "نسيان الكتب", "استخدام الهاتف", "شغب في الحصة"
]

class SchoolApp:
    def __init__(self):
        self.school_data = {}
        self.current_class = None

    def main(self, page: ft.Page):
        # --- إعدادات الصفحة ---
        page.title = "المساعد المدرسي"
        page.rtl = True
        page.theme_mode = ft.ThemeMode.LIGHT
        page.scroll = None
        page.window_width = 400
        page.window_height = 800
        page.bgcolor = "#f0f4f8"

        # --- دوال البيانات ---
        def save_data():
            page.client_storage.set("school_db_v2", self.school_data)

        def load_data():
            try:
                stored = page.client_storage.get("school_db_v2")
                if stored and isinstance(stored, dict):
                    self.school_data = stored
                    # الإصلاح التلقائي
                    for class_name, students in self.school_data.items():
                        for student in students:
                            if "positive_notes" not in student: student["positive_notes"] = []
                            if "negative_notes" not in student: student["negative_notes"] = []
                            if "score" not in student: student["score"] = 0
                    save_data()
                else:
                    self.school_data = {}
            except Exception:
                self.school_data = {}

        def clear_all_data(e):
            page.client_storage.clear()
            self.school_data = {}
            show_classes_view()
            page.snack_bar = ft.SnackBar(ft.Text("تم حذف جميع البيانات"))
            page.snack_bar.open = True
            page.update()

        # --- دوال الاستيراد والتصدير ---
        file_picker = ft.FilePicker()
        page.overlay.append(file_picker)

        def import_data_action(e: ft.FilePickerResultEvent):
            if e.files:
                try:
                    file_path = e.files[0].path
                    file_name = e.files[0].name
                    added_count = 0

                    # قائمة لتخزين البيانات المقروءة (صف بصف)
                    raw_data = []

                    # 1. قراءة الملف حسب نوعه بدون استخدام pandas
                    if file_name.endswith(('.xlsx', '.xls')):
                        # قراءة Excel باستخدام openpyxl
                        wb = openpyxl.load_workbook(file_path, data_only=True)
                        sheet = wb.active
                        rows = list(sheet.iter_rows(values_only=True))
                        if rows:
                            headers = [str(h).strip() for h in rows[0]] # الصف الأول عناوين
                            for row in rows[1:]:
                                if row: # تجاهل الصفوف الفارغة
                                    # تحويل الصف إلى قاموس
                                    row_dict = {}
                                    for i, header in enumerate(headers):
                                        if i < len(row):
                                            row_dict[header] = row[i]
                                    raw_data.append(row_dict)

                    elif file_name.endswith('.csv'):
                        # قراءة CSV باستخدام مكتبة csv القياسية
                        with open(file_path, mode='r', encoding='utf-8-sig') as f:
                            reader = csv.DictReader(f)
                            for row in reader:
                                # تنظيف المفاتيح من المسافات
                                clean_row = {k.strip(): v for k, v in row.items() if k}
                                raw_data.append(clean_row)
                    else:
                        raise Exception("صيغة غير مدعومة")

                    # 2. معالجة البيانات وإضافتها
                    for row in raw_data:
                        # البحث عن اسم العمود المحتمل
                        c_name = None
                        s_name = None
                        
                        # احتمالات أسماء الأعمدة
                        for key in row.keys():
                            if not key: continue
                            k_lower = str(key).lower()
                            if "فصل" in k_lower or "class" in k_lower:
                                c_name = row[key]
                            elif "طالب" in k_lower or "اسم" in k_lower or "student" in k_lower or "name" in k_lower:
                                s_name = row[key]

                        # تعيين قيم افتراضية إذا لم يتم العثور
                        if not c_name: c_name = "فصل عام"
                        
                        class_name = str(c_name).strip()
                        student_name = str(s_name).strip() if s_name else ""

                        if class_name and student_name and student_name.lower() != "none":
                            if class_name not in self.school_data:
                                self.school_data[class_name] = []
                            
                            # منع التكرار
                            if not any(s['name'] == student_name for s in self.school_data[class_name]):
                                new_student = {
                                    "name": student_name,
                                    "score": 0,
                                    "positive_notes": [],
                                    "negative_notes": [],
                                    "present": True
                                }
                                self.school_data[class_name].append(new_student)
                                added_count += 1
                    
                    save_data()
                    show_classes_view()
                    page.snack_bar = ft.SnackBar(ft.Text(f"تم استيراد {added_count} طالب بنجاح"), bgcolor="green")
                    page.snack_bar.open = True
                except Exception as ex:
                    page.snack_bar = ft.SnackBar(ft.Text(f"خطأ: {ex}"), bgcolor="red")
                    page.snack_bar.open = True
                page.update()

        file_picker.on_result = import_data_action

        def export_data_action(e):
            if not self.school_data:
                page.snack_bar = ft.SnackBar(ft.Text("لا توجد بيانات للتصدير"))
                page.snack_bar.open = True
                page.update()
                return

            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["الفصل", "الطالب", "النقاط", "الإيجابيات", "السلبيات"])

            for class_name, students in self.school_data.items():
                for student in students:
                    pos_str = " | ".join(student.get('positive_notes', []))
                    neg_str = " | ".join(student.get('negative_notes', []))
                    writer.writerow([
                        class_name,
                        student['name'],
                        student['score'],
                        pos_str,
                        neg_str
                    ])
            
            csv_data = output.getvalue().encode("utf-8-sig")
            b64_data = base64.b64encode(csv_data).decode()
            page.launch_url(f"data:text/csv;base64,{b64_data}", web_window_name="_blank")

        # --- شاشة بطاقة الطالب ---
        def show_student_card(student, class_name):
            if "positive_notes" not in student: student["positive_notes"] = []
            if "negative_notes" not in student: student["negative_notes"] = []

            pos_checks = []
            for note in POSITIVE_BEHAVIORS:
                is_checked = note in student["positive_notes"]
                pos_checks.append(ft.Checkbox(label=note, value=is_checked))

            neg_checks = []
            for note in NEGATIVE_BEHAVIORS:
                is_checked = note in student["negative_notes"]
                neg_checks.append(ft.Checkbox(label=note, value=is_checked, fill_color="red"))

            def save_card_changes(e):
                selected_pos = [c.label for c in pos_checks if c.value]
                selected_neg = [c.label for c in neg_checks if c.value]

                old_score_impact = len(student["positive_notes"]) - len(student["negative_notes"])
                new_score_impact = len(selected_pos) - len(selected_neg)
                score_diff = new_score_impact - old_score_impact
                
                student["positive_notes"] = selected_pos
                student["negative_notes"] = selected_neg
                student["score"] += score_diff

                save_data()
                score_display.value = f"النقاط: {student['score']}"
                score_display.update()
                page.snack_bar = ft.SnackBar(ft.Text("تم حفظ التعديلات!"), bgcolor="green")
                page.snack_bar.open = True
                page.update()

            score_display = ft.Text(f"النقاط: {student['score']}", size=20, weight="bold", color="white")

            tabs = ft.Tabs(
                selected_index=0,
                animation_duration=300,
                tabs=[
                    ft.Tab(text="الإيجابيات (+1)", icon=ft.icons.THUMB_UP, 
                           content=ft.Container(padding=15, content=ft.Column([*pos_checks, ft.Divider(), ft.ElevatedButton("حفظ", icon=ft.icons.SAVE, on_click=save_card_changes, bgcolor="green", color="white", width=200)], scroll="auto"))),
                    ft.Tab(text="السلبيات (-1)", icon=ft.icons.THUMB_DOWN,
                           content=ft.Container(padding=15, content=ft.Column([*neg_checks, ft.Divider(), ft.ElevatedButton("حفظ", icon=ft.icons.SAVE, on_click=save_card_changes, bgcolor="red", color="white", width=200)], scroll="auto")))
                ],
                expand=True
            )

            dlg = ft.AlertDialog(
                title=ft.Container(bgcolor="indigo", padding=10, border_radius=10, content=ft.Row([ft.Icon(ft.icons.ACCOUNT_CIRCLE, color="white"), ft.Text(student['name'], color="white", weight="bold"), ft.Container(expand=True), score_display])),
                content=ft.Container(width=500, height=450, content=tabs),
                actions=[ft.TextButton("إغلاق", on_click=lambda e: close_dialog_and_refresh(class_name))],
                actions_alignment=ft.MainAxisAlignment.CENTER
            )
            page.dialog = dlg
            dlg.open = True
            page.update()

        def close_dialog_and_refresh(class_name):
            page.close_dialog()
            show_students_view(class_name)

        # --- شاشة المعلومات ---
        def show_info_dialog(e):
            dlg = ft.AlertDialog(
                title=ft.Text("معلومات البرنامج"),
                content=ft.Column([
                    ft.ListTile(leading=ft.Icon(ft.icons.PERSON), title=ft.Text("المعلم"), subtitle=ft.Text("محمد درويش الزعابي")),
                    ft.ListTile(leading=ft.Icon(ft.icons.SCHOOL), title=ft.Text("المدرسة"), subtitle=ft.Text("الإبداع للبنين")),
                    ft.ListTile(leading=ft.Icon(ft.icons.INFO), title=ft.Text("الإصدار"), subtitle=ft.Text("3.0 (Lite Edition)")),
                ], tight=True),
                actions=[ft.TextButton("إغلاق", on_click=lambda e: page.close_dialog())]
            )
            page.dialog = dlg
            dlg.open = True
            page.update()

        # --- شاشة الإحصائيات ---
        def show_stats_view():
            main_list.controls.clear()
            page.appbar.title.value = "لوحة الإحصائيات"
            page.appbar.leading = ft.IconButton(ft.icons.ARROW_BACK, on_click=lambda e: show_classes_view())
            page.appbar.actions = []

            all_students = []
            for c_name, s_list in self.school_data.items():
                for s in s_list:
                    all_students.append({**s, 'class': c_name})
            
            if not all_students:
                main_list.controls.append(ft.Text("لا توجد بيانات", text_align="center"))
                page.update()
                return

            top_student = max(all_students, key=lambda x: x['score'])
            
            grid = ft.Row([
                ft.Container(bgcolor="blue", padding=20, border_radius=10, expand=True, content=ft.Column([ft.Text("الطلاب", color="white"), ft.Text(str(len(all_students)), color="white", size=25, weight="bold")])),
                ft.Container(bgcolor="orange", padding=20, border_radius=10, expand=True, content=ft.Column([ft.Text("الفصول", color="white"), ft.Text(str(len(self.school_data)), color="white", size=25, weight="bold")])),
            ])
            main_list.controls.append(grid)

            if top_student:
                best_card = ft.Card(content=ft.Container(padding=15, content=ft.ListTile(leading=ft.Icon(ft.icons.STAR, color="yellow", size=40), title=ft.Text(f"نجم المدرسة: {top_student['name']}", weight="bold"), subtitle=ft.Text(f"الفصل: {top_student['class']} | النقاط: {top_student['score']}"))))
                main_list.controls.append(ft.Text("الأعلى نقاطاً", weight="bold"))
                main_list.controls.append(best_card)
            page.update()

        # --- القوائم الرئيسية ---
        main_list = ft.ListView(expand=True, spacing=10, padding=15)
        txt_class = ft.TextField(hint_text="اسم الفصل", expand=True, bgcolor="white", border_radius=10, height=50)
        txt_student = ft.TextField(hint_text="اسم الطالب", expand=True, bgcolor="white", border_radius=10, height=50)

        def show_classes_view():
            self.current_class = None
            main_list.controls.clear()
            page.appbar.title.value = "الرئيسية"
            page.appbar.leading = ft.IconButton(ft.icons.INFO_OUTLINE, on_click=show_info_dialog)
            page.appbar.actions = [
                ft.IconButton(ft.icons.BAR_CHART, on_click=lambda e: show_stats_view()),
                ft.PopupMenuButton(items=[
                    ft.PopupMenuItem(text="استيراد Excel/CSV", icon=ft.icons.UPLOAD, on_click=lambda e: file_picker.pick_files()),
                    ft.PopupMenuItem(text="تصدير CSV", icon=ft.icons.DOWNLOAD, on_click=export_data_action),
                    ft.PopupMenuItem(text="تصفير الكل", icon=ft.icons.DELETE_FOREVER, on_click=clear_all_data),
                ])
            ]
            main_list.controls.append(ft.Row([txt_class, ft.FloatingActionButton(icon=ft.icons.ADD, on_click=add_class_action)]))
            
            for name in self.school_data:
                count = len(self.school_data[name])
                main_list.controls.append(ft.Card(elevation=3, content=ft.ListTile(leading=ft.Icon(ft.icons.CLASS_, color="indigo"), title=ft.Text(name, weight="bold"), subtitle=ft.Text(f"{count} طالب"), trailing=ft.IconButton(ft.icons.DELETE, icon_color="red", on_click=lambda e, n=name: delete_class(n)), on_click=lambda e, n=name: show_students_view(n))))
            page.update()

        def show_students_view(class_name):
            main_list.controls.clear()
            page.appbar.title.value = class_name
            page.appbar.leading = ft.IconButton(ft.icons.ARROW_BACK, on_click=lambda e: show_classes_view())
            page.appbar.actions = []
            main_list.controls.append(ft.Row([txt_student, ft.FloatingActionButton(icon=ft.icons.PERSON_ADD, bgcolor="green", on_click=lambda e: add_student_action(class_name))]))
            
            students = self.school_data[class_name]
            for student in students:
                bg_color = "white"
                if student['score'] > 5: bg_color = ft.colors.GREEN_50
                elif student['score'] < -5: bg_color = ft.colors.RED_50
                
                main_list.controls.append(ft.Card(color=bg_color, elevation=2, content=ft.ListTile(leading=ft.CircleAvatar(content=ft.Text(str(student['score']), size=12, color="white"), bgcolor="indigo"), title=ft.Text(student['name'], weight="bold"), subtitle=ft.Text(f"+ {len(student.get('positive_notes', []))} | - {len(student.get('negative_notes', []))}"), trailing=ft.IconButton(ft.icons.DELETE_OUTLINE, icon_color="red", size=20, on_click=lambda e, s=student: delete_student(class_name, s)), on_click=lambda e, s=student: show_student_card(s, class_name))))
            page.update()

        def add_class_action(e):
            if txt_class.value and txt_class.value not in self.school_data:
                self.school_data[txt_class.value] = []
                save_data()
                txt_class.value = ""
                show_classes_view()

        def add_student_action(class_name):
            if txt_student.value:
                new_s = {"name": txt_student.value, "score": 0, "positive_notes": [], "negative_notes": []}
                self.school_data[class_name].append(new_s)
                save_data()
                txt_student.value = ""
                show_students_view(class_name)

        def delete_class(name):
            del self.school_data[name]
            save_data()
            show_classes_view()

        def delete_student(class_name, student):
            self.school_data[class_name].remove(student)
            save_data()
            show_students_view(class_name)

        load_data()
        page.appbar = ft.AppBar(bgcolor="indigo", color="white")
        page.add(main_list)
        show_classes_view()

if __name__ == "__main__":
    app = SchoolApp()
    ft.app(target=app.main)
