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
        # نلغي التمرير العام للصفحة ونعتمد على القوائم الداخلية
        page.scroll = None 
        page.bgcolor = "#f2f2f7" # لون خلفية iOS الرمادي الفاتح

        # --- إدارة البيانات ---
        def load_data():
            try:
                data = page.client_storage.get("school_db_final")
                if isinstance(data, dict):
                    self.school_data = data
                else:
                    self.school_data = {}
            except:
                self.school_data = {}

        def save_data():
            page.client_storage.set("school_db_final", self.school_data)

        # تحميل البيانات عند البدء
        load_data()

        # --- عناصر الواجهة المشتركة ---
        txt_class_name = ft.TextField(hint_text="اسم الفصل الجديد", bgcolor="white", border_radius=10, expand=True)
        txt_student_name = ft.TextField(hint_text="اسم الطالب الجديد", bgcolor="white", border_radius=10, expand=True)
        
        # لاقط الملفات (للاستيراد)
        file_picker = ft.FilePicker()
        page.overlay.append(file_picker)

        # --- دالة معالجة الاستيراد (داخل الفصل) ---
        def on_file_picked(e: ft.FilePickerResultEvent):
            if not e.files or not self.current_class:
                return

            try:
                file_path = e.files[0].path
                file_name = e.files[0].name
                new_students = []

                # قراءة الملف حسب نوعه
                raw_rows = []
                if file_name.endswith(('.xlsx', '.xls')):
                    wb = openpyxl.load_workbook(file_path, data_only=True)
                    sheet = wb.active
                    for row in sheet.iter_rows(values_only=True):
                        raw_rows.append([str(cell) for cell in row if cell])
                
                elif file_name.endswith('.csv'):
                    with open(file_path, 'r', encoding='utf-8-sig', errors='ignore') as f:
                        reader = csv.reader(f)
                        for row in reader:
                            raw_rows.append(row)

                # البحث الذكي عن الأسماء
                # نبحث في كل خلية عن اسم طالب، نتجاهل العناوين
                count = 0
                current_students = self.school_data[self.current_class]
                existing_names = {s['name'] for s in current_students}

                for row in raw_rows:
                    for cell in row:
                        val = str(cell).strip()
                        # شروط لفلترة العناوين والأرقام
                        if len(val) > 2 and not val.isdigit() and "اسم" not in val and "Name" not in val and "طالب" not in val:
                            if val not in existing_names:
                                # إضافة الطالب
                                current_students.append({
                                    "name": val, "score": 0, 
                                    "pos": [], "neg": []
                                })
                                existing_names.add(val)
                                count += 1

                save_data()
                show_students_view(self.current_class) # تحديث الواجهة
                
                page.snack_bar = ft.SnackBar(ft.Text(f"تم استيراد {count} اسم بنجاح"), bgcolor="green")
                page.snack_bar.open = True
                page.update()

            except Exception as ex:
                page.snack_bar = ft.SnackBar(ft.Text(f"خطأ في الملف: {ex}"), bgcolor="red")
                page.snack_bar.open = True
                page.update()

        file_picker.on_result = on_file_picked

        # --- دالة التصدير (نسخ للحافظة) ---
        def export_class_data(e):
            if not self.current_class: return
            
            students = self.school_data[self.current_class]
            output = "الاسم\tالنقاط\tالإيجابيات\tالسلبيات\n"
            
            for s in students:
                p_str = ",".join(s.get('pos', []))
                n_str = ",".join(s.get('neg', []))
                output += f"{s['name']}\t{s['score']}\t{p_str}\t{n_str}\n"

            page.set_clipboard(output)
            page.snack_bar = ft.SnackBar(ft.Text("تم نسخ بيانات الفصل! يمكنك لصقها في Excel أو الواتساب"), bgcolor="blue")
            page.snack_bar.open = True
            page.update()

        # --- التنقل (Router) ---
        def route_change(route):
            page.views.clear()
            
            # --- الصفحة الرئيسية: الفصول ---
            if page.route == "/":
                
                def add_class(e):
                    if txt_class_name.value:
                        if txt_class_name.value not in self.school_data:
                            self.school_data[txt_class_name.value] = []
                            save_data()
                            txt_class_name.value = ""
                            route_change(None) # إعادة تحميل
                        else:
                            txt_class_name.error_text = "موجود مسبقاً"
                            txt_class_name.update()

                def delete_class(name):
                    del self.school_data[name]
                    save_data()
                    route_change(None)

                def go_to_class(name):
                    self.current_class = name
                    page.go("/class")

                # قائمة الفصول
                classes_lv = ft.ListView(expand=True, spacing=10, padding=15)
                
                if not self.school_data:
                    classes_lv.controls.append(ft.Container(
                        content=ft.Text("لا توجد فصول.. أضف فصلاً للبدء", color="grey", size=16),
                        alignment=ft.alignment.center, padding=50
                    ))

                for name in self.school_data:
                    count = len(self.school_data[name])
                    classes_lv.controls.append(
                        ft.Card(
                            elevation=2,
                            content=ft.ListTile(
                                leading=ft.Icon(ft.icons.CLASS_, color="indigo"),
                                title=ft.Text(name, weight="bold", size=18),
                                subtitle=ft.Text(f"{count} طالب"),
                                trailing=ft.IconButton(ft.icons.DELETE, icon_color="red", 
                                    on_click=lambda e, n=name: delete_class(n)),
                                on_click=lambda e, n=name: go_to_class(n)
                            )
                        )
                    )

                page.views.append(
                    ft.View(
                        "/",
                        [
                            ft.AppBar(title=ft.Text("الفصول الدراسية"), bgcolor="indigo", color="white"),
                            ft.Container(
                                padding=10, bgcolor="white",
                                content=ft.Row([
                                    txt_class_name,
                                    ft.FloatingActionButton(icon=ft.icons.ADD, on_click=add_class)
                                ])
                            ),
                            classes_lv
                        ],
                        bgcolor="#f2f2f7"
                    )
                )

            # --- صفحة الطلاب ---
            elif page.route == "/class":
                
                current_students = self.school_data.get(self.current_class, [])

                def add_student(e):
                    if txt_student_name.value:
                        new_s = {"name": txt_student_name.value, "score": 0, "pos": [], "neg": []}
                        self.school_data[self.current_class].append(new_s)
                        save_data()
                        txt_student_name.value = ""
                        txt_student_name.focus()
                        # تحديث القائمة فوراً
                        show_students_view(self.current_class)

                def delete_student(idx):
                    self.school_data[self.current_class].pop(idx)
                    save_data()
                    show_students_view(self.current_class)

                # دالة لفتح بطاقة الطالب
                def open_card(idx):
                    student = self.school_data[self.current_class][idx]
                    
                    # دوال حفظ البطاقة
                    def save_card(e):
                        # حساب الاختيارات
                        sel_pos = [cb.label for cb in dlg.content.content.tabs[0].content.content.controls if isinstance(cb, ft.Checkbox) and cb.value]
                        sel_neg = [cb.label for cb in dlg.content.content.tabs[1].content.content.controls if isinstance(cb, ft.Checkbox) and cb.value]
                        
                        # تحديث الطالب
                        student['pos'] = sel_pos
                        student['neg'] = sel_neg
                        # معادلة النقاط: (عدد الإيجابيات - عدد السلبيات)
                        student['score'] = len(sel_pos) - len(sel_neg)
                        
                        save_data()
                        page.close_dialog()
                        show_students_view(self.current_class)

                    # محتوى التبويبات
                    pos_col = ft.Column(scroll="auto")
                    for p in POSITIVE_BEHAVIORS:
                        pos_col.controls.append(ft.Checkbox(label=p, value=p in student.get('pos', [])))
                    
                    neg_col = ft.Column(scroll="auto")
                    for n in NEGATIVE_BEHAVIORS:
                        neg_col.controls.append(ft.Checkbox(label=n, value=n in student.get('neg', []), fill_color="red"))

                    tabs = ft.Tabs(
                        selected_index=0,
                        tabs=[
                            ft.Tab(text="إيجابي", content=ft.Container(content=pos_col, padding=10)),
                            ft.Tab(text="سلبي", content=ft.Container(content=neg_col, padding=10))
                        ],
                        expand=True
                    )

                    dlg = ft.AlertDialog(
                        title=ft.Text(student['name']),
                        content=ft.Container(height=300, width=300, content=tabs),
                        actions=[ft.TextButton("حفظ وإغلاق", on_click=save_card)]
                    )
                    page.dialog = dlg
                    dlg.open = True
                    page.update()

                # بناء قائمة الطلاب
                students_lv = ft.ListView(expand=True, spacing=5, padding=10)
                
                if not current_students:
                    students_lv.controls.append(ft.Text("لا يوجد طلاب.. أضف يدوياً أو استورد ملف", text_align="center", color="grey"))

                for i, s in enumerate(current_students):
                    score = s.get('score', 0)
                    color = "black"
                    if score > 0: color = "green"
                    elif score < 0: color = "red"

                    students_lv.controls.append(
                        ft.Card(
                            elevation=1,
                            content=ft.ListTile(
                                leading=ft.CircleAvatar(
                                    content=ft.Text(str(score), weight="bold", color="white"),
                                    bgcolor=color
                                ),
                                title=ft.Text(s['name'], weight="bold"),
                                trailing=ft.IconButton(ft.icons.DELETE_OUTLINE, icon_color="grey", 
                                    on_click=lambda e, idx=i: delete_student(idx)),
                                on_click=lambda e, idx=i: open_card(idx)
                            )
                        )
                    )

                page.views.append(
                    ft.View(
                        "/class",
                        [
                            ft.AppBar(
                                title=ft.Text(self.current_class),
                                bgcolor="indigo", color="white",
                                leading=ft.IconButton(ft.icons.ARROW_BACK, on_click=lambda _: page.go("/")),
                                actions=[
                                    ft.IconButton(ft.icons.UPLOAD_FILE, tooltip="استيراد ملف", 
                                        on_click=lambda _: file_picker.pick_files(allowed_extensions=["xlsx", "xls", "csv"])),
                                    ft.IconButton(ft.icons.COPY, tooltip="نسخ البيانات", on_click=export_class_data)
                                ]
                            ),
                            ft.Container(
                                padding=10, bgcolor="white",
                                content=ft.Row([
                                    txt_student_name,
                                    ft.FloatingActionButton(icon=ft.icons.PERSON_ADD, bgcolor="green", on_click=add_student)
                                ])
                            ),
                            students_lv
                        ],
                        bgcolor="#f2f2f7"
                    )
                )

            page.update()

        # دالة مساعدة لتحديث الصفحة الحالية فقط
        def show_students_view(cls_name):
            route_change(None)

        # --- تشغيل ---
        page.on_route_change = route_change
        page.go("/")

if __name__ == "__main__":
    app = SchoolApp()
    ft.app(target=app.main)
