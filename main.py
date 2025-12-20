import flet as ft
import traceback  # مكتبة مهمة تظهر تفاصيل الخطأ

class StudentApp:
    def __init__(self):
        # قائمة افتراضية للطلاب
        self.students = [
            {"name": "أحمد محمد", "score": 0, "present": True},
            {"name": "سعيد علي", "score": 0, "present": True},
            {"name": "خالد يوسف", "score": 0, "present": True},
        ]

    def build_ui(self, page: ft.Page):
        # هذه الدالة تحتوي على كود الواجهة الأصلي الخاص بك
        page.title = "سجل المتابعة الصفي"
        page.rtl = True
        page.theme_mode = ft.ThemeMode.LIGHT
        page.scroll = "auto"
        page.window_width = 400
        page.window_height = 700

        new_student_name = ft.TextField(hint_text="اسم الطالب الجديد", expand=True)

        students_column = ft.Column()

        def render_students():
            students_column.controls.clear()
            for i, student in enumerate(self.students):
                score_text = ft.Text(f"النقاط: {student['score']}", size=16, weight="bold")
                status_icon = ft.Icon(
                    name=ft.icons.CHECK_CIRCLE if student['present'] else ft.icons.CANCEL,
                    color="green" if student['present'] else "red"
                )
                
                def add_points(e, idx=i):
                    self.students[idx]['score'] += 1
                    render_students()
                    page.update()

                def remove_points(e, idx=i):
                    self.students[idx]['score'] -= 1
                    render_students()
                    page.update()

                def toggle_attendance(e, idx=i):
                    self.students[idx]['present'] = not self.students[idx]['present']
                    render_students()
                    page.update()

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
                                ft.IconButton(ft.icons.THUMB_UP, icon_color="blue", on_click=add_points),
                                ft.IconButton(ft.icons.THUMB_DOWN, icon_color="orange", on_click=remove_points),
                                ft.IconButton(ft.icons.CHANGE_CIRCLE, icon_color="grey", on_click=toggle_attendance),
                            ])
                        ])
                    )
                )
                students_column.controls.append(card)

        def add_student(e):
            if new_student_name.value:
                self.students.append({"name": new_student_name.value, "score": 0, "present": True})
                new_student_name.value = ""
                render_students()
                page.update()

        render_students()

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

    def main(self, page: ft.Page):
        # --- نظام الحماية من الشاشة البيضاء ---
        try:
            # نحاول تشغيل الواجهة
            self.build_ui(page)
        except Exception as e:
            # إذا حدث أي خطأ، نعرضه على الشاشة بدلاً من البياض
            page.clean()
            page.add(
                ft.Column([
                    ft.Icon(ft.icons.ERROR, color="red", size=50),
                    ft.Text("حدث خطأ أثناء التشغيل:", size=20, weight="bold", color="red"),
                    ft.Text(f"{e}", size=16),
                    ft.Container(
                        content=ft.Text(traceback.format_exc(), size=12, font_family="monospace"),
                        bgcolor=ft.colors.GREY_200,
                        padding=10,
                        border_radius=5
                    )
                ], scroll="adaptive")
            )
            page.update()

# تشغيل التطبيق
if __name__ == "__main__":
    app = StudentApp()
    ft.app(target=app.main)

