import flet as ft
import openpyxl
import csv
import io

# --- السلوكيات ---
POSITIVE_BEHAVIORS = ["مشاركة", "واجبات", "احترام", "نظافة", "تعاون", "إبداع"]
NEGATIVE_BEHAVIORS = ["إزعاج", "نسيان", "تأخر", "غياب", "نوم", "هاتف"]

class SchoolApp:
    def __init__(self):
        self.school_data = {}
        self.current_class = ""

    def main(self, page: ft.Page):
        # --- إعدادات الصفحة ---
        page.title = "المساعد المدرسي"
        page.rtl = True
        page.theme_mode = ft.ThemeMode.LIGHT
        page.scroll = None 
        page.bgcolor = "#f2f2f7"

        # --- إدارة البيانات ---
        def load_data():
            try:
                data = page.client_storage.get("school_db_final_v3")
                if isinstance(data, dict):
                    self.school_data = data
                    # إصلاح البيانات القديمة لتشمل الحضور
                    for cls in self.school_data.values():
                        for s in cls:
                            if "present" not in s: s["present"] = True
                else:
                    self.school_data = {}
            except:
                self.school_data = {}

        def save_data():
            page.client_storage.set("school_db_final_v3", self.school_data)

        load_data()

        # --- عناصر الواجهة ---
        txt_class_name = ft.TextField(hint_text="اسم الفصل الجديد", bgcolor="white", border_radius=10, expand=True)
        txt_student_name = ft.TextField(hint_text="اسم الطالب الجديد", bgcolor="white", border_radius=10, expand=True)
        file_picker = ft.FilePicker()
        page.overlay.append(file_picker)

        # --- نافذة المعلومات (الهوية) ---
        def show_info_dialog(e):
            dlg = ft.AlertDialog(
                title=ft.Text("معلومات التطبيق", weight="bold"),
                content=ft.Column([
                    ft.Container(
                        padding=10,
                        bgcolor=ft.colors.BLUE_50,
                        border_radius=10,
                        content=ft.Column([
                            ft.ListTile(
                                leading=ft.Icon(ft.icons.PERSON, color="indigo"),
                                title=ft.Text("إعداد المعلم", weight="bold"),
                                subtitle=ft.Text("محمد درويش الزعابي", size=16, color="black")
                            ),
                            ft.Divider(),
                            ft.ListTile(
                                leading=ft.Icon(ft.icons.SCHOOL, color="indigo"),
                                title=ft.Text("المدرسة", weight="bold"),
                                subtitle=ft.Text("الإبداع للبنين", size=16, color="black")
                            ),
                        ])
                    ),
                    ft.Text("الإصدار 3.5 (نسخة المعلم)", size=12, color="grey", text_align="center")
                ], tight=True, spacing=20),
                actions=[
                    ft.TextButton("إغلاق", on_click=lambda e: page.close_dialog())
                ],
                actions_alignment=ft.MainAxisAlignment.CENTER
            )
            page.dialog = dlg
            dlg.open = True
            page.update()

        # --- دالة الاستيراد ---
        def on_file_picked(e: ft.FilePickerResultEvent):
            if not e.files or not self.current_class: return

            try:
                file_path = e.files[0].path
                file_name = e.files[0].name
                raw_rows = []
                count = 0

                # معالجة Excel
                if file_name.endswith(('.xlsx', '.xls')):
                    wb = openpyxl.load_workbook(file_path, data_only=True)
                    sheet = wb.active
                    for row in sheet.iter_rows(values_only=True):
                        raw_rows.append([str(cell) if cell else "" for cell in row])
                
                # معالجة CSV (مع حل مشكلة الرموز)
                elif file_name.endswith('.csv'):
                    encodings = ['utf-8-sig', 'utf-8', 'windows-1256', 'cp1256']
                    for enc in encodings:
                        try:
                            with open(file_path, 'r', encoding=enc) as f:
                                raw_rows = list(csv.reader(f))
                            break
                        except UnicodeDecodeError:
                            continue
                    
                    if not raw_rows: raise Exception("فشل قراءة الملف")

                # إضافة الأسماء
                current_students = self.school_data[self.current_class]
                existing_names = {s['name'] for s in current_students}

                for row in raw_rows:
                    for cell in row:
                        val = str(cell).strip()
                        if len(val) > 2 and not val.isdigit() and "اسم" not in val and "Name" not in val and "طالب" not in val:
                            if val not in existing_names:
                                current_students.append({
                                    "name": val, "score": 0, 
                                    "pos": [], "neg": [], "present": True
                                })
                                existing_names.add(val)
                                count += 1

                save_data()
                show_students_view(self.current_class)
                page.snack_bar = ft.SnackBar(ft.Text(f"تم استيراد {count} طالب بنجاح"), bgcolor="green")
                page.snack_bar.open = True
                page.update()

            except Exception as ex:
                page.snack_bar = ft.SnackBar(ft.Text(f"خطأ: {ex}"), bgcolor="red")
                page.snack_bar.open = True
                page.update()

        file_picker.on_result = on_file_picked

        # --- دالة التصدير ---
        def export_class_data(e):
            if not self.current_class: return
            students = self.school_data[self.current_class]
            output = "الاسم\tالحضور\tالنقاط\tالإيجابيات\tالسلبيات\n"
            for s in students:
                status = "حاضر" if s.get('present', True) else "غائب"
                p_str = ",".join(s.get('pos', []))
                n_str = ",".join(s.get('neg', []))
                output += f"{s['name']}\t{status}\t{s['score']}\t{p_str}\t{n_str}\n"
            page.set_clipboard(output)
            page.snack_bar = ft.SnackBar(ft.Text("تم نسخ البيانات للحافظة"), bgcolor="blue")
            page.snack_bar.open = True
            page.update()

        # --- التنقل ---
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

                classes_lv = ft.ListView(expand=True, spacing=10, padding=15)
                for name in self.school_data:
                    count = len(self.school_data[name])
                    classes_lv.controls.append(
                        ft.Card(
                            elevation=3,
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
                        ft.AppBar(
                            title=ft.Text("الفصول الدراسية"), 
                            bgcolor="indigo", color="white",
                            # هنا زر المعلومات (الهوية)
                            leading=ft.IconButton(ft.icons.INFO_OUTLINE, tooltip="معلومات المعلم", on_click=show_info_dialog)
                        ),
                        ft.Container(padding=10, bgcolor="white", content=ft.Row([txt_class_name, ft.FloatingActionButton(icon=ft.icons.ADD, on_click=add_class)])),
                        classes_lv
                    ], bgcolor="#f2f2f7")
                )

            # --- صفحة الفصل ---
            elif page.route == "/class":
                current_students = self.school_data.get(self.current_class, [])

                def add_student(e):
                    if txt_student_name.value:
                        self.school_data[self.current_class].append({"name": txt_student_name.value, "score": 0, "pos": [], "neg": [], "present": True})
                        save_data()
                        txt_student_name.value = ""
                        show_students_view(self.current_class)

                def toggle_attendance(idx):
                    s = self.school_data[self.current_class][idx]
                    s['present'] = not s.get('present', True)
                    save_data()
                    show_students_view(self.current_class)

                def delete_student(idx):
                    self.school_data[self.current_class].pop(idx)
                    save_data()
                    show_students_view(self.current_class)

                def open_card(idx):
                    student = self.school_data[self.current_class][idx]
                    
                    def save_card(e):
                        sel_pos = [cb.label for cb in dlg.content.content.tabs[0].content.content.controls if isinstance(cb, ft.Checkbox) and cb.value]
                        sel_neg = [cb.label for cb in dlg.content.content.tabs[1].content.content.controls if isinstance(cb, ft.Checkbox) and cb.value]
                        student['pos'] = sel_pos
                        student['neg'] = sel_neg
                        student['score'] = len(sel_pos) - len(sel_neg)
                        save_data()
                        page.close_dialog()
                        show_students_view(self.current_class)

                    pos_col = ft.Column([ft.Checkbox(label=p, value=p in student.get('pos', [])) for p in POSITIVE_BEHAVIORS], scroll="auto")
                    neg_col = ft.Column([ft.Checkbox(label=n, value=n in student.get('neg', []), fill_color="red") for n in NEGATIVE_BEHAVIORS], scroll="auto")

                    tabs = ft.Tabs(selected_index=0, tabs=[
                        ft.Tab(text="إيجابي", content=ft.Container(content=pos_col, padding=10)),
                        ft.Tab(text="سلبي", content=ft.Container(content=neg_col, padding=10))
                    ], expand=True)

                    dlg = ft.AlertDialog(title=ft.Text(student['name']), content=ft.Container(height=300, width=300, content=tabs), actions=[ft.TextButton("حفظ", on_click=save_card)])
                    page.dialog = dlg
                    dlg.open = True
                    page.update()

                students_lv = ft.ListView(expand=True, spacing=5, padding=10)
                
                for i, s in enumerate(current_students):
                    score = s.get('score', 0)
                    is_present = s.get('present', True)
                    
                    # تنسيق البطاقة حسب الحضور
                    card_color = "white" if is_present else "#eeeeee"
                    opacity = 1.0 if is_present else 0.5
                    att_icon = ft.icons.CHECK_CIRCLE if is_present else ft.icons.CANCEL
                    att_color = "green" if is_present else "grey"

                    students_lv.controls.append(
                        ft.Card(
                            elevation=1 if is_present else 0,
                            color=card_color,
                            content=ft.ListTile(
                                opacity=opacity,
                                # زر الحضور
                                leading=ft.IconButton(
                                    icon=att_icon, icon_color=att_color, 
                                    tooltip="تحضير/تغييب",
                                    on_click=lambda e, idx=i: toggle_attendance(idx)
                                ),
                                title=ft.Text(s['name'], weight="bold"),
                                subtitle=ft.Text(f"النقاط: {score}", color="blue" if score >= 0 else "red"),
                                trailing=ft.Row([
                                    ft.IconButton(ft.icons.EDIT, icon_color="blue", on_click=lambda e, idx=i: open_card(idx)),
                                    ft.IconButton(ft.icons.DELETE_OUTLINE, icon_color="red", on_click=lambda e, idx=i: delete_student(idx)),
                                ], main_axis_alignment=ft.MainAxisAlignment.END, width=100),
                            )
                        )
                    )

                page.views.append(
                    ft.View("/class", [
                        ft.AppBar(
                            title=ft.Text(self.current_class), bgcolor="indigo", color="white",
                            leading=ft.IconButton(ft.icons.ARROW_BACK, on_click=lambda _: page.go("/")),
                            actions=[
                                ft.IconButton(ft.icons.UPLOAD_FILE, on_click=lambda _: file_picker.pick_files(allowed_extensions=["xlsx", "xls", "csv"])),
                                ft.IconButton(ft.icons.COPY, on_click=export_class_data)
                            ]
                        ),
                        ft.Container(padding=10, bgcolor="white", content=ft.Row([txt_student_name, ft.FloatingActionButton(icon=ft.icons.PERSON_ADD, bgcolor="green", on_click=add_student)])),
                        students_lv
                    ], bgcolor="#f2f2f7")
                )
            page.update()

        def show_students_view(cls_name):
            route_change(None)

        page.on_route_change = route_change
        page.go("/")

if __name__ == "__main__":
    app = SchoolApp()
    ft.app(target=app.main)
