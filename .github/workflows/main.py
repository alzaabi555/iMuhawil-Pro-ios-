import flet as ft
import pandas as pd
import io
import csv
import base64

# --- بيانات ثابتة ---
POSITIVE_BEHAVIORS = [
    "مشاركة ممتازة", "حل واجب منزلي", "التزام بالنظام",
    "مساعدة زميل", "إجابة صحيحة", "نظافة شخصية"
]
NEGATIVE_BEHAVIORS = [
    "نسيان كتاب", "تأخر عن الحصة", "حديث جانبي",
    "عدم حل الواجب", "استخدام الهاتف", "شغب بسيط"
]

class SchoolApp:
    def __init__(self):
        self.school_data = {}
        self.current_class = None
        self.current_student = None

    def main(self, page: ft.Page):
        page.title = "المساعد المدرسي الذكي"
        page.rtl = True
        page.theme_mode = ft.ThemeMode.LIGHT
        page.scroll = None
        page.window_width = 400
        page.window_height = 800
        page.bgcolor = "#f8f9fa" # خلفية عصرية فاتحة

        # --- دوال البيانات ---
        def load_data():
            try:
                stored = page.client_storage.get("school_db_v2")
                if stored and isinstance(stored, dict):
                    self.school_data = stored
                else:
                    self.school_data = {}
            except:
                self.school_data = {}

        def save_data():
            page.client_storage.set("school_db_v2", self.school_data)

        def clear_all_data(e):
            page.client_storage.clear()
            self.school_data = {}
            show_classes_view()
            page.snack_bar = ft.SnackBar(ft.Text("تم تصفير البيانات"))
            page.snack_bar.open = True
            page.update()

        # --- دوال الاستيراد والتصدير ---
        file_picker = ft.FilePicker()
        page.overlay.append(file_picker)

        def import_data_action(e: ft.FilePickerResultEvent):
            if e.files:
                try:
                    file = e.files[0]
                    if file.name.endswith(('.xlsx', '.xls')):
                        df = pd.read_excel(file.path)
                    elif file.name.endswith('.csv'):
                        df = pd.read_csv(file.path)
                    else:
                        raise Exception("صيغة الملف غير مدعومة")

                    # نفترض أن الملف يحتوي على عمودين: "الفصل" و "الطالب"
                    for _, row in df.iterrows():
                        class_name = str(row.get("الفصل", "عام")).strip()
                        student_name = str(row.get("الطالب", "")).strip()
                        
                        if class_name and student_name:
                            if class_name not in self.school_data:
                                self.school_data[class_name] = []
                            
                            # التحقق من عدم تكرار الطالب في نفس الفصل
                            if not any(s['name'] == student_name for s in self.school_data[class_name]):
                                new_student = {
                                    "name": student_name,
                                    "score": 0,
                                    "positive_notes": [],
                                    "negative_notes": []
                                }
                                self.school_data[class_name].append(new_student)
                    
                    save_data()
                    show_classes_view()
                    page.snack_bar = ft.SnackBar(ft.Text("تم استيراد البيانات بنجاح!"))
                    page.snack_bar.open = True
                except Exception as ex:
                    page.snack_bar = ft.SnackBar(ft.Text(f"خطأ في الاستيراد: {ex}"), bgcolor="red")
                    page.snack_bar.open = True
                page.update()

        file_picker.on_result = import_data_action

        def export_data_action(e):
            if not self.school_data:
                return

            output = io.StringIO()
            writer = csv.writer(output)
            # كتابة رأس الجدول
            writer.writerow(["الفصل", "اسم الطالب", "النقاط", "الإيجابيات", "السلبيات"])

            for class_name, students in self.school_data.items():
                for student in students:
                    writer.writerow([
                        class_name,
                        student['name'],
                        student['score'],
                        " - ".join(student['positive_notes']),
                        " - ".join(student['negative_notes'])
                    ])
            
            csv_data = output.getvalue().encode("utf-8-sig") # إضافة BOM لدعم العربية في Excel
            b64_data = base64.b64encode(csv_data).decode()
            
            # طريقة بسيطة لفتح نافذة الحفظ (تعمل بشكل أفضل على الويب وسطح المكتب)
            # على الموبايل قد تفتح مباشرة في المتصفح أو تطبيق عرض CSV
            page.launch_url(f"data:text/csv;base64,{b64_data}", web_window_name="_blank")


        # --- شاشة "معلومات" ---
        def show_info_dialog(e):
            dlg = ft.AlertDialog(
                title=ft.Text("عن التطبيق", weight="bold", size=20),
                content=ft.Column([
                    ft.Row([ft.Icon(ft.icons.DEVELOPER_MODE, color="blue"), ft.Text("المطور: محمد درويش الزعابي", size=16)]),
                    ft.Divider(height=20),
                    ft.Row([ft.Icon(ft.icons.SCHOOL, color="green"), ft.Text("المدرسة: الإبداع للبنين", size=16)]),
                ], tight=True, spacing=10),
                actions=[ft.TextButton("إغلاق", on_click=lambda e: page.close_dialog())],
                actions_alignment=ft.MainAxisAlignment.END,
            )
            page.dialog = dlg
            dlg.open = True
            page.update()

        # --- شاشة "بطاقة الطالب" المحسنة ---
        def show_student_card(student_data, class_name, student_idx):
            self.current_student = student_data
            
            # حقول الاختيار
            pos_checks = [ft.Checkbox(label=note, value=note in student_data['positive_notes']) for note in POSITIVE_BEHAVIORS]
            neg_checks = [ft.Checkbox(label=note, value=note in student_data['negative_notes']) for note in NEGATIVE_BEHAVIORS]

            def save_notes_action(e):
                # تحديث الإيجابيات
                new_pos = [c.label for c in pos_checks if c.value]
                added_pos = len(new_pos) - len(student_data['positive_notes'])
                student_data['positive_notes'] = new_pos
                
                # تحديث السلبيات
                new_neg = [c.label for c in neg_checks if c.value]
                added_neg = len(new_neg) - len(student_data['negative_notes'])
                student_data['negative_notes'] = new_neg

                # تحديث النقاط (مثال: كل إيجابية +1، كل سلبية -1)
                student_data['score'] += added_pos
                student_data['score'] -= added_neg

                save_data()
                # تحديث واجهة البطاقة لإظهار النقاط الجديدة
                score_txt.value = f"النقاط: {student_data['score']}"
                score_txt.update()
                page.snack_bar = ft.SnackBar(ft.Text("تم حفظ الملاحظات وتحديث النقاط"))
                page.snack_bar.open = True
                page.update()

            score_txt = ft.Text(f"النقاط: {student_data['score']}", size=20, weight="bold", color="blue")

            tabs = ft.Tabs(
                selected_index=0,
                animation_duration=300,
                tabs=[
                    ft.Tab(
                        text="الإيجابيات",
                        icon=ft.icons.THUMB_UP,
                        content=ft.Container(
                            padding=20,
                            content=ft.Column([
                                ft.Text("اختر الملاحظات الإيجابية:", weight="bold"),
                                *pos_checks,
                                ft.ElevatedButton("حفظ وتحديث النقاط", icon=ft.icons.SAVE, on_click=save_notes_action, bgcolor="green", color="white")
                            ], spacing=15, scroll="auto")
                        )
                    ),
                    ft.Tab(
                        text="السلبيات",
                        icon=ft.icons.THUMB_DOWN,
                        content=ft.Container(
                            padding=20,
                            content=ft.Column([
                                ft.Text("اختر الملاحظات السلبية:", weight="bold"),
                                *neg_checks,
                                ft.ElevatedButton("حفظ وتحديث النقاط", icon=ft.icons.SAVE, on_click=save_notes_action, bgcolor="red", color="white")
                            ], spacing=15, scroll="auto")
                        )
                    ),
                ],
                expand=True,
            )
            
            dlg = ft.AlertDialog(
                title=ft.Row([
                    ft.Icon(ft.icons.PERSON, size=30, color="indigo"),
                    ft.Text(student_data['name'], size=24, weight="bold"),
                    ft.Container(expand=True),
                    score_txt
                ]),
                content=ft.Container(
                    width=500,
                    height=500, # ارتفاع ثابت للتبويبات
                    content=tabs,
                ),
                actions=[ft.TextButton("إغلاق", on_click=lambda e: close_card_action())],
                actions_alignment=ft.MainAxisAlignment.END,
            )

            def close_card_action():
                page.close_dialog()
                show_students_view(class_name) # تحديث القائمة خلف البطاقة

            page.dialog = dlg
            dlg.open = True
            page.update()


        # --- شاشة الإحصائيات ---
        def show_stats_view():
            page.appbar.title.value = "الإحصائيات العامة"
            page.appbar.leading = ft.IconButton(ft.icons.ARROW_BACK, icon_color="white", on_click=lambda e: show_classes_view())
            page.appbar.actions = []
            main_list.controls.clear()

            total_students = sum(len(s) for s in self.school_data.values())
            total_classes = len(self.school_data)
            
            all_students = []
            for c_name, s_list in self.school_data.items():
                for s in s_list:
                    all_students.append({**s, 'class': c_name})
            
            top_student = max(all_students, key=lambda x: x['score']) if all_students else None
            low_student = min(all_students, key=lambda x: x['score']) if all_students else None

            def create_stat_card(title, value, icon, color):
                return ft.Card(
                    elevation=4,
                    color=color,
                    content=ft.Container(
                        padding=20,
                        content=ft.Column([
                            ft.Row([ft.Icon(icon, color="white", size=30), ft.Container(width=10), ft.Text(title, color="white", size=16)]),
                            ft.Text(str(value), color="white", size=28, weight="bold", text_align="center")
                        ], spacing=5)
                    )
                )

            # صفوف البطاقات الإحصائية
            row1 = ft.Row([
                ft.Container(create_stat_card("إجمالي الفصول", total_classes, ft.icons.CLASS_, "blue"), expand=True),
                ft.Container(create_stat_card("إجمالي الطلاب", total_students, ft.icons.PEOPLE, "indigo"), expand=True),
            ], spacing=15)
            
            row2 = ft.Row()
            if top_student:
                row2.controls.append(ft.Container(create_stat_card(f"الأعلى: {top_student['name']}", top_student['score'], ft.icons.STAR, "green"), expand=True))
            if low_student:
                row2.controls.append(ft.Container(create_stat_card(f"الأقل: {low_student['name']}", low_student['score'], ft.icons.TRENDING_DOWN, "red"), expand=True))
            
            main_list.controls.append(ft.Container(content=ft.Column([row1, row2], spacing=15), padding=20))
            
            # جدول تفصيلي بسيط
            if all_students:
                main_list.controls.append(ft.Text("ترتيب الطلاب (الأعلى نقاطاً)", size=18, weight="bold", color="indigo"))
                data_table = ft.DataTable(
                    columns=[
                        ft.DataColumn(ft.Text("الاسم")),
                        ft.DataColumn(ft.Text("الفصل")),
                        ft.DataColumn(ft.Text("النقاط", numeric=True)),
                    ],
                    rows=[
                        ft.DataRow(cells=[
                            ft.DataCell(ft.Text(s['name'])),
                            ft.DataCell(ft.Text(s['class'])),
                            ft.DataCell(ft.Text(str(s['score']))),
                        ]) for s in sorted(all_students, key=lambda x: x['score'], reverse=True)[:10] # أفضل 10 فقط
                    ],
                    border=ft.border.all(1, "grey"),
                    border_radius=10,
                    vertical_lines=ft.border.BorderSide(1, "grey"),
                    heading_row_color=ft.colors.BLUE_50,
                )
                main_list.controls.append(ft.Container(content=data_table, padding=ft.padding.only(bottom=20)))

            page.update()

        # --- القائمة الرئيسية (ListView) ---
        main_list = ft.ListView(expand=True, spacing=10, padding=20)
        txt_class_name = ft.TextField(hint_text="اسم الفصل (مثلاً: 5/2)", bgcolor="white", border_radius=10, expand=True, prefix_icon=ft.icons.CLASS_)
        txt_student_name = ft.TextField(hint_text="اسم الطالب", bgcolor="white", border_radius=10, expand=True, prefix_icon=ft.icons.PERSON_ADD)

        # --- الشاشات الرئيسية ---
        def show_classes_view():
            self.current_class = None
            main_list.controls.clear()
            page.appbar.title.value = "الفصول الدراسية"
            page.appbar.leading = ft.IconButton(ft.icons.INFO_OUTLINE, icon_color="white", tooltip="عن البرنامج", on_click=show_info_dialog)
            page.appbar.actions = [
                ft.IconButton(ft.icons.BAR_CHART, icon_color="white", tooltip="الإحصائيات", on_click=lambda e: show_stats_view()),
                ft.PopupMenuButton(
                    icon=ft.icons.MORE_VERT,
                    icon_color="white",
                    items=[
                        ft.PopupMenuItem(text="استيراد (Excel/CSV)", icon=ft.icons.UPLOAD_FILE, on_click=lambda e: file_picker.pick_files(allowed_extensions=["xlsx", "xls", "csv"])),
                        ft.PopupMenuItem(text="تصدير الكل (CSV)", icon=ft.icons.DOWNLOAD, on_click=export_data_action),
                        ft.PopupMenuItem(text="تصفير البيانات", icon=ft.icons.DELETE_FOREVER, on_click=clear_all_data),
                    ]
                ),
            ]

            add_section = ft.Container(
                bgcolor="white", padding=15, border_radius=15, shadow=ft.BoxShadow(blur_radius=5, color=ft.colors.GREY_300),
                content=ft.Row([txt_class_name, ft.IconButton(ft.icons.ADD_CIRCLE, icon_color="indigo", icon_size=45, on_click=add_class_action)])
            )
            main_list.controls.append(add_section)

            if not self.school_data:
                main_list.controls.append(ft.Container(content=ft.Column([ft.Icon(ft.icons.SCHOOL_OUTLINED, size=60, color="grey"), ft.Text("لا توجد فصول، ابدأ بإضافة فصل", color="grey")], alignment=ft.MainAxisAlignment.CENTER, spacing=10), alignment=ft.alignment.center, padding=40))

            for class_name in list(self.school_data.keys()):
                student_count = len(self.school_data[class_name])
                
                def open_curr_class(e, name=class_name): show_students_view(name)
                def delete_curr_class(e, name=class_name):
                    del self.school_data[name]
                    save_data()
                    show_classes_view()
                    page.update()

                card = ft.Card(
                    elevation=4, shadow_color=ft.colors.GREY_200,
                    content=ft.Container(
                        padding=15, ink=True, on_click=open_curr_class, border_radius=10,
                        content=ft.Row([
                            ft.Container(content=ft.Icon(ft.icons.MEETING_ROOM, color="white"), bgcolor="indigo", padding=10, border_radius=10),
                            ft.Container(width=15),
                            ft.Column([ft.Text(class_name, size=20, weight="bold"), ft.Text(f"{student_count} طالب", size=14, color="grey")]),
                            ft.Container(expand=True),
                            ft.IconButton(ft.icons.DELETE_OUTLINE, icon_color="red", on_click=delete_curr_class)
                        ])
                    )
                )
                main_list.controls.append(card)
            page.update()

        def show_students_view(class_name):
            self.current_class = class_name
            main_list.controls.clear()
            page.appbar.title.value = f"طلاب: {class_name}"
            page.appbar.leading = ft.IconButton(ft.icons.ARROW_BACK_IOS_NEW, icon_color="white", on_click=lambda e: show_classes_view())
            page.appbar.actions = []

            add_section = ft.Container(
                bgcolor="white", padding=15, border_radius=15, shadow=ft.BoxShadow(blur_radius=5, color=ft.colors.GREY_300),
                content=ft.Row([txt_student_name, ft.IconButton(ft.icons.PERSON_ADD_ALT_1, icon_color="green", icon_size=45, on_click=add_student_action)])
            )
            main_list.controls.append(add_section)

            students = self.school_data[class_name]
            if not students:
                main_list.controls.append(ft.Container(content=ft.Text("الفصل فارغ، أضف طلاباً", color="grey"), alignment=ft.alignment.center, padding=30))

            for i, student in enumerate(students):
                # استخدام i الحالية لفتح البطاقة الصحيحة
                def open_student_card_wrapper(e, idx=i):
                    show_student_card(students[idx], class_name, idx)

                def delete_student(e, idx=i):
                    students.pop(idx)
                    save_data()
                    show_students_view(class_name)

                # لون الخلفية بناء على النقاط (مؤشر بصري سريع)
                bg_color = "white"
                if student['score'] > 5: bg_color = ft.colors.GREEN_50
                elif student['score'] < -5: bg_color = ft.colors.RED_50

                card = ft.Card(
                    color=bg_color, elevation=2,
                    content=ft.Container(
                        padding=12, ink=True, on_click=open_student_card_wrapper, border_radius=10,
                        content=ft.Row([
                            ft.CircleAvatar(content=ft.Text(student['name'][0], weight="bold"), bgcolor=ft.colors.BLUE_GREY_100, color="indigo"),
                            ft.Container(width=15),
                            ft.Text(student['name'], size=18, weight="bold"),
                            ft.Container(expand=True),
                            ft.Container(content=ft.Text(f"{student['score']}", color="white", weight="bold"), bgcolor="indigo", padding=8, border_radius=20, width=50, alignment=ft.alignment.center),
                            ft.IconButton(ft.icons.DELETE_FOREVER, icon_color="red", icon_size=20, on_click=delete_student)
                        ])
                    )
                )
                main_list.controls.append(card)
            page.update()

        # --- الأزرار ---
        def add_class_action(e):
            if txt_class_name.value:
                if txt_class_name.value not in self.school_data:
                    self.school_data[txt_class_name.value] = []
                    save_data()
                    txt_class_name.value = ""
                    show_classes_view()
                else:
                    txt_class_name.error_text = "موجود مسبقاً"
                    page.update()

        def add_student_action(e):
            if txt_student_name.value and self.current_class:
                # هيكل البيانات الجديد للطالب
                new_stu = {"name": txt_student_name.value, "score": 0, "positive_notes": [], "negative_notes": []}
                self.school_data[self.current_class].append(new_stu)
                save_data()
                txt_student_name.value = ""
                txt_student_name.focus()
                show_students_view(self.current_class)

        # --- تشغيل التطبيق ---
        load_data()
        page.appbar = ft.AppBar(
            title=ft.Text(""), center_title=True, bgcolor="indigo", color="white", elevation=4,
            leading=ft.IconButton(ft.icons.INFO_OUTLINE, icon_color="white", tooltip="عن البرنامج", on_click=show_info_dialog)
        )
        page.add(main_list)
        show_classes_view()

if __name__ == "__main__":
    app = SchoolApp()
    ft.app(target=app.main)
