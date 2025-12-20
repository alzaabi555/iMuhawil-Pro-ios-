import flet as ft
import traceback

class SchoolApp:
    def __init__(self):
        # البيانات الآن عبارة عن قاموس يحتوي الفصول
        # الهيكل: { "الصف الخامس": [طالب1, طالب2], "الصف السادس": [...] }
        self.school_data = {} 
        self.current_class = None # لتتبع الفصل المفتوح حالياً

    def main(self, page: ft.Page):
        # --- إعدادات الصفحة ---
        page.title = "المساعد المدرسي الذكي"
        page.rtl = True
        page.theme_mode = ft.ThemeMode.LIGHT
        page.scroll = "auto"
        page.window_width = 400
        page.window_height = 800
        page.bgcolor = "#f5f5f5" # خلفية رمادية فاتحة عصرية

        # --- دوال البيانات (الحفظ والتحميل) ---
        def load_data():
            # تحميل البيانات من ذاكرة الهاتف
            stored_data = page.client_storage.get("school_db")
            if stored_data:
                self.school_data = stored_data
            else:
                self.school_data = {}

        def save_data():
            # حفظ البيانات فوراً
            page.client_storage.set("school_db", self.school_data)

        # تحميل البيانات عند البدء
        load_data()

        # --- عناصر الواجهة المتغيرة ---
        main_column = ft.Column(scroll="auto", expand=True)
        
        # حقل إضافة فصل جديد
        new_class_input = ft.TextField(
            hint_text="اسم الفصل (مثلاً: خامس/2)", 
            bgcolor="white", 
            border_radius=10,
            expand=True
        )

        # حقل إضافة طالب جديد
        new_student_input = ft.TextField(
            hint_text="اسم الطالب الجديد", 
            bgcolor="white", 
            border_radius=10,
            expand=True
        )

        # --- دوال التنطق والرسم ---

        def show_classes_view():
            """عرض قائمة الفصول الدراسية"""
            self.current_class = None
            page.appbar.title.value = "الفصول الدراسية"
            page.appbar.leading = ft.Icon(ft.icons.SCHOOL, color="white")
            page.appbar.actions = [] # إخفاء زر الحذف العام
            
            main_column.controls.clear()

            # منطقة إضافة فصل
            add_row = ft.Row([
                new_class_input,
                ft.FloatingActionButton(
                    icon=ft.icons.ADD, 
                    bgcolor=ft.colors.INDIGO, 
                    on_click=add_class
                )
            ], alignment=ft.MainAxisAlignment.CENTER)
            
            main_column.controls.append(ft.Container(content=add_row, padding=10))

            if not self.school_data:
                main_column.controls.append(
                    ft.Container(
                        content=ft.Text("لا توجد فصول، أضف فصلاً للبدء", color="grey", size=16),
                        alignment=ft.alignment.center,
                        padding=50
                    )
                )

            # رسم بطاقات الفصول
            for class_name in self.school_data:
                student_count = len(self.school_data[class_name])
                
                # دالة لحذف الفصل
                def delete_class_action(e, name=class_name):
                    del self.school_data[name]
                    save_data()
                    show_classes_view()
                    page.update()

                # دالة لفتح الفصل
                def open_class_action(e, name=class_name):
                    self.current_class = name
                    show_students_view(name)
                    page.update()

                class_card = ft.Card(
                    elevation=2,
                    surface_tint_color="white",
                    content=ft.Container(
                        padding=15,
                        on_click=open_class_action, # جعل البطاقة قابلة للضغط
                        content=ft.Row([
                            ft.Icon(ft.icons.CLASS_, color=ft.colors.INDIGO, size=30),
                            ft.Container(width=10),
                            ft.Column([
                                ft.Text(class_name, size=18, weight="bold"),
                                ft.Text(f"عدد الطلاب: {student_count}", size=12, color="grey"),
                            ]),
                            ft.Container(expand=True),
                            ft.IconButton(
                                icon=ft.icons.DELETE_OUTLINE, 
                                icon_color="red", 
                                tooltip="حذف الفصل",
                                on_click=delete_class_action
                            )
                        ])
                    )
                )
                main_column.controls.append(class_card)
            
            page.update()

        def show_students_view(class_name):
            """عرض قائمة الطلاب داخل فصل معين"""
            page.appbar.title.value = f"طلاب {class_name}"
            # زر الرجوع
            page.appbar.leading = ft.IconButton(
                icon=ft.icons.ARROW_BACK, 
                icon_color="white", 
                on_click=lambda e: show_classes_view()
            )
            
            main_column.controls.clear()

            # منطقة إضافة طالب
            add_row = ft.Row([
                new_student_input,
                ft.FloatingActionButton(
                    icon=ft.icons.PERSON_ADD, 
                    bgcolor=ft.colors.GREEN, 
                    on_click=add_student
                )
            ], alignment=ft.MainAxisAlignment.CENTER)
            
            main_column.controls.append(ft.Container(content=add_row, padding=10))

            students_list = self.school_data[class_name]

            if not students_list:
                main_column.controls.append(
                    ft.Container(
                        content=ft.Text("لا يوجد طلاب في هذا الفصل", color="grey"),
                        alignment=ft.alignment.center,
                        padding=30
                    )
                )

            for i, student in enumerate(students_list):
                
                # دوال التعامل مع الطالب
                def update_score(e, idx=i, delta=0):
                    students_list[idx]['score'] += delta
                    save_data()
                    show_students_view(class_name) # إعادة رسم لتحديث الرقم
                    page.update()

                def toggle_present(e, idx=i):
                    students_list[idx]['present'] = not students_list[idx]['present']
                    save_data()
                    show_students_view(class_name)
                    page.update()

                def delete_student(e, idx=i):
                    students_list.pop(idx)
                    save_data()
                    show_students_view(class_name)
                    page.update()

                # الألوان بناء على الحالة
                status_color = ft.colors.GREEN if student['present'] else ft.colors.RED_200
                bg_color = "white" if student['present'] else ft.colors.GREY_100

                student_card = ft.Card(
                    color=bg_color,
                    elevation=1,
                    content=ft.Container(
                        padding=10,
                        content=ft.Column([
                            ft.Row([
                                ft.Icon(ft.icons.PERSON, color=ft.colors.BLUE_GREY),
                                ft.Text(student['name'], size=16, weight="bold", color="black"),
                                ft.Container(expand=True),
                                ft.IconButton(ft.icons.DELETE_FOREVER, icon_color="red", size=20, on_click=delete_student)
                            ]),
                            ft.Divider(height=10, color="transparent"),
                            ft.Row([
                                ft.Container(
                                    content=ft.Text(f"النقاط: {student['score']}", weight="bold", color="white"),
                                    bgcolor=ft.colors.BLUE,
                                    padding=5,
                                    border_radius=5
                                ),
                                ft.Container(expand=True),
                                ft.IconButton(ft.icons.REMOVE_CIRCLE_OUTLINE, icon_color="orange", on_click=lambda e: update_score(e, delta=-1)),
                                ft.IconButton(ft.icons.ADD_CIRCLE_OUTLINE, icon_color="green", on_click=lambda e: update_score(e, delta=1)),
                                ft.Container(width=10),
                                ft.IconButton(
                                    icon=ft.icons.CHECK_CIRCLE if student['present'] else ft.icons.CANCEL,
                                    icon_color=status_color,
                                    tooltip="تحضير/غياب",
                                    on_click=toggle_present
                                )
                            ])
                        ])
                    )
                )
                main_column.controls.append(student_card)

            page.update()

        # --- دوال الإضافة ---
        def add_class(e):
            name = new_class_input.value
            if name:
                if name not in self.school_data:
                    self.school_data[name] = [] # فصل جديد فارغ
                    save_data()
                    new_class_input.value = ""
                    show_classes_view()
                else:
                    # تنبيه إذا الاسم مكرر (يمكن إضافة SnackBar هنا)
                    new_class_input.error_text = "الفصل موجود بالفعل"
                    page.update()

        def add_student(e):
            name = new_student_input.value
            if name and self.current_class:
                # هيكل بيانات الطالب
                new_student = {"name": name, "score": 0, "present": True}
                self.school_data[self.current_class].append(new_student)
                save_data()
                new_student_input.value = ""
                show_students_view(self.current_class)

        # --- بناء الصفحة الرئيسية ---
        page.appbar = ft.AppBar(
            title=ft.Text("المدرسة الذكية"),
            center_title=True,
            bgcolor=ft.colors.INDIGO,
            color="white"
        )
        
        page.add(main_column)
        
        # التشغيل الأولي
        show_classes_view()

if __name__ == "__main__":
    try:
        app = SchoolApp()
        ft.app(target=app.main)
    except Exception as e:
        # طباعة الخطأ في حال حدوثه لا سمح الله
        print(traceback.format_exc())
