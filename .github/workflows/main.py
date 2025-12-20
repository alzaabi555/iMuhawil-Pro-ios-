import flet as ft
import traceback

class SchoolApp:
    def __init__(self):
        self.school_data = {}
        self.current_class = None

    def main(self, page: ft.Page):
        # --- إعدادات الصفحة الهامة جداً للموبايل ---
        page.title = "المساعد المدرسي"
        page.rtl = True
        page.theme_mode = ft.ThemeMode.LIGHT
        
        # هام جداً: نلغي تمرير الصفحة الرئيسية لمنع التعليق
        # التمرير سيكون داخل القوائم فقط
        page.scroll = None 
        
        page.window_width = 400
        page.window_height = 800
        page.bgcolor = "#f0f2f5"

        # --- منطقة البيانات ---
        def load_data():
            try:
                stored = page.client_storage.get("school_db")
                if stored and isinstance(stored, dict):
                    self.school_data = stored
                else:
                    self.school_data = {}
            except:
                self.school_data = {}

        def save_data():
            page.client_storage.set("school_db", self.school_data)

        # زر طوارئ لحذف البيانات إذا علق التطبيق
        def clear_all_data(e):
            page.client_storage.clear()
            self.school_data = {}
            show_classes_view()
            page.snack_bar = ft.SnackBar(ft.Text("تم تصفير جميع البيانات بنجاح"))
            page.snack_bar.open = True
            page.update()

        load_data()

        # --- القائمة الرئيسية (ListView بدلاً من Column لمنع التعليق) ---
        # expand=1 يعني خذ كل المساحة المتبقية
        main_list = ft.ListView(expand=1, spacing=10, padding=20)

        # حقول الإدخال
        txt_class_name = ft.TextField(hint_text="اسم الفصل (مثلاً: 5/2)", bgcolor="white", border_radius=10, expand=True)
        txt_student_name = ft.TextField(hint_text="اسم الطالب", bgcolor="white", border_radius=10, expand=True)

        # --- الشاشات ---

        def show_classes_view():
            """شاشة الفصول"""
            self.current_class = None
            
            # تنظيف القائمة
            main_list.controls.clear()
            
            # إعداد الشريط العلوي
            page.appbar.title.value = "الفصول الدراسية"
            page.appbar.leading = ft.Icon(ft.icons.HOME, color="white")
            # زر تصفير البيانات للطوارئ
            page.appbar.actions = [
                ft.IconButton(ft.icons.DELETE_SWEEP, icon_color="white", tooltip="تصفير الكل", on_click=clear_all_data)
            ]

            # قسم إضافة فصل
            add_section = ft.Container(
                bgcolor="white",
                padding=10,
                border_radius=10,
                content=ft.Row([
                    txt_class_name,
                    ft.IconButton(ft.icons.ADD_CIRCLE, icon_color="indigo", icon_size=40, on_click=add_class_action)
                ])
            )
            main_list.controls.append(add_section)

            # عرض الفصول
            if not self.school_data:
                main_list.controls.append(ft.Text("لا توجد فصول، أضف فصلاً جديداً", color="grey", text_align="center"))

            for class_name in list(self.school_data.keys()):
                student_count = len(self.school_data[class_name])
                
                # استخدام Closure لحفظ اسم الفصل
                def open_curr_class(e, name=class_name):
                    show_students_view(name)

                def delete_curr_class(e, name=class_name):
                    del self.school_data[name]
                    save_data()
                    show_classes_view()
                    page.update()

                card = ft.Card(
                    elevation=3,
                    content=ft.Container(
                        padding=15,
                        on_click=open_curr_class, # الضغط هنا يفتح الفصل
                        content=ft.Row([
                            ft.Icon(ft.icons.MEETING_ROOM, color="indigo"),
                            ft.Column([
                                ft.Text(class_name, size=18, weight="bold"),
                                ft.Text(f"{student_count} طالب", size=12, color="grey")
                            ]),
                            ft.Container(expand=True),
                            ft.IconButton(ft.icons.DELETE, icon_color="red", on_click=delete_curr_class)
                        ])
                    )
                )
                main_list.controls.append(card)
            
            page.update()

        def show_students_view(class_name):
            """شاشة الطلاب"""
            self.current_class = class_name
            main_list.controls.clear()
            
            page.appbar.title.value = f"طلاب: {class_name}"
            page.appbar.leading = ft.IconButton(ft.icons.ARROW_BACK, icon_color="white", on_click=lambda e: show_classes_view())
            page.appbar.actions = []

            # قسم إضافة طالب
            add_section = ft.Container(
                bgcolor="white",
                padding=10,
                border_radius=10,
                content=ft.Row([
                    txt_student_name,
                    ft.IconButton(ft.icons.PERSON_ADD, icon_color="green", icon_size=40, on_click=add_student_action)
                ])
            )
            main_list.controls.append(add_section)

            students = self.school_data[class_name]
            
            if not students:
                main_list.controls.append(ft.Container(content=ft.Text("الفصل فارغ", color="grey"), alignment=ft.alignment.center, padding=20))

            for i, student in enumerate(students):
                
                # دوال التحكم
                def change_score(e, idx=i, val=1):
                    students[idx]['score'] += val
                    save_data()
                    # تحديث النص فقط بدلاً من إعادة رسم القائمة كاملة (أسرع)
                    e.control.parent.controls[0].content.value = f"النقاط: {students[idx]['score']}"
                    e.control.parent.controls[0].content.update()

                def delete_student(e, idx=i):
                    students.pop(idx)
                    save_data()
                    show_students_view(class_name)

                def toggle_absent(e, idx=i):
                    students[idx]['present'] = not students[idx]['present']
                    save_data()
                    show_students_view(class_name)

                is_present = student['present']
                bg_card = "white" if is_present else "#ffebee" # أحمر فاتح للغياب

                card = ft.Card(
                    color=bg_card,
                    content=ft.Container(
                        padding=10,
                        content=ft.Column([
                            ft.Row([
                                ft.Icon(ft.icons.PERSON),
                                ft.Text(student['name'], size=16, weight="bold"),
                                ft.Container(expand=True),
                                ft.IconButton(ft.icons.CLOSE, icon_color="red", icon_size=18, on_click=delete_student)
                            ]),
                            ft.Divider(height=5, color="transparent"),
                            ft.Row([
                                # مربع النقاط
                                ft.Container(
                                    content=ft.Text(f"النقاط: {student['score']}", color="white", weight="bold"),
                                    bgcolor="blue", padding=5, border_radius=5, width=80, alignment=ft.alignment.center
                                ),
                                ft.Container(width=10),
                                ft.IconButton(ft.icons.REMOVE_CIRCLE, icon_color="orange", on_click=lambda e, i=i: change_score(e, i, -1)),
                                ft.IconButton(ft.icons.ADD_CIRCLE, icon_color="green", on_click=lambda e, i=i: change_score(e, i, 1)),
                                ft.Container(expand=True),
                                ft.Switch(value=is_present, active_color="green", on_change=toggle_absent)
                            ])
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
                new_stu = {"name": txt_student_name.value, "score": 0, "present": True}
                self.school_data[self.current_class].append(new_stu)
                save_data()
                txt_student_name.value = ""
                # إعادة التركيز على حقل الإدخال
                txt_student_name.focus()
                show_students_view(self.current_class)

        # --- تشغيل التطبيق ---
        page.appbar = ft.AppBar(title=ft.Text(""), bgcolor="indigo", color="white")
        
        # إضافة القائمة للصفحة
        page.add(main_list)
        
        show_classes_view()

if __name__ == "__main__":
    app = SchoolApp()
    ft.app(target=app.main)
