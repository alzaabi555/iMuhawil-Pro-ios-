import flet as ft

class StudentApp:
    def __init__(self):
        # قائمة افتراضية للطلاب (يمكن لاحقاً ربطها بقاعدة بيانات)
        self.students = [
            {"name": "أحمد محمد", "score": 0, "present": True},
            {"name": "سعيد علي", "score": 0, "present": True},
            {"name": "خالد يوسف", "score": 0, "present": True},
        ]

    def main(self, page: ft.Page):
        page.title = "سجل المتابعة الصفي"
        page.rtl = True  # تفعيل الاتجاه من اليمين لليسار
        page.theme_mode = ft.ThemeMode.LIGHT
        page.scroll = "adaptive"
        page.window_width = 400  # محاكاة عرض الهاتف
        page.window_height = 700

        # حقل إدخال اسم طالب جديد
        new_student_name = ft.TextField(hint_text="اسم الطالب الجديد", expand=True)

        def add_student(e):
            if new_student_name.value:
                self.students.append({"name": new_student_name.value, "score": 0, "present": True})
                new_student_name.value = ""
                render_students()
                page.update()

        # دالة لتحديث واجهة قائمة الطلاب
        students_column = ft.Column()

        def render_students():
            students_column.controls.clear()
            for i, student in enumerate(self.students):
                
                # تعريف عناصر التحكم لكل طالب
                score_text = ft.Text(f"النقاط: {student['score']}", size=16, weight="bold")
                status_icon = ft.Icon(
                    name=ft.icons.CHECK_CIRCLE if student['present'] else ft.icons.CANCEL,
                    color="green" if student['present'] else "red"
                )
                
                # دالة لزيادة النقاط
                def add_points(e, idx=i):
                    self.students[idx]['score'] += 1
                    render_students()
                    page.update()

                # دالة لخصم النقاط
                def remove_points(e, idx=i):
                    self.students[idx]['score'] -= 1
                    render_students()
                    page.update()

                # دالة تبديل الحضور والغياب
                def toggle_attendance(e, idx=i):
                    self.students[idx]['present'] = not self.students[idx]['present']
                    render_students()
                    page.update()

                # تصميم بطاقة الطالب
                card = ft.Card(
                    content=ft.Container(
                        padding=10,
                        content=ft.Column([
                            ft.Row([
                                ft.Icon(ft.icons.PERSON),
                                ft.Text(student['name'], size=18, weight="bold"),
                                ft.Spacer(),
                                status_icon,
                            ]),
                            ft.Divider(),
                            ft.Row([
                                score_text,
                                ft.Spacer(),
                                ft.IconButton(ft.icons.THUMB_UP, icon_color="blue", on_click=add_points, tooltip="سلوك إيجابي"),
                                ft.IconButton(ft.icons.THUMB_DOWN, icon_color="orange", on_click=remove_points, tooltip="سلوك سلبي"),
                                ft.IconButton(ft.icons.CHANGE_CIRCLE, icon_color="grey", on_click=toggle_attendance, tooltip="حضور/غياب"),
                            ])
                        ])
                    )
                )
                students_column.controls.append(card)

        # استدعاء أولي للعرض
        render_students()

        # تصميم الرأس وإضافة العناصر للصفحة
        header = ft.AppBar(
            title=ft.Text("نظام متابعة الطلاب"),
            center_title=True,
            bgcolor=ft.colors.BLUE,
            color=ft.colors.WHITE
        )

        input_row = ft.Row([
            new_student_name,
            ft.FloatingActionButton(icon=ft.icons.ADD, on_click=add_student)
        ])

        page.add(header, input_row, students_column)

# تشغيل التطبيق
if __name__ == "__main__":
    app = StudentApp()
    ft.app(target=app.main)