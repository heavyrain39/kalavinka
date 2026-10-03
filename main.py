import sys
# ===> 수정: QtCore 모듈 임포트 <===
from PySide6.QtWidgets import QApplication, QMainWindow, QLabel
from PySide6 import QtCore # 또는 from PySide6.QtCore import Qt 를 사용하고 Qt.AlignCenter 로 써도 됩니다.

# 1. QApplication 객체 생성
# PySide6 애플리케이션을 실행하기 위한 필수 객체입니다.
app = QApplication(sys.argv)

# 2. QMainWindow 객체 생성
# 애플리케이션의 메인 창 역할을 하는 객체입니다.
main_window = QMainWindow()

# 3. 창 제목 설정
main_window.setWindowTitle("노동요 생성기 (로컬)")

# 4. 창 크기 설정 (옵션)
main_window.setGeometry(100, 100, 600, 400) # x, y, width, height

# 5. 중앙 위젯 생성 (옵션 - 간단한 라벨 추가)
# QMainWindow는 중앙 위젯을 가질 수 있습니다. 여기에 실제 UI 내용이 들어갑니다.
central_widget = QLabel("PySide6 기본 창 테스트")
central_widget.setStyleSheet("font-size: 20px; text-align: center; padding: 50px;") # 간단한 스타일
# ===> 수정: sys.Flags.AlignCenter 대신 QtCore.Qt.AlignCenter 사용 <===
central_widget.setAlignment(QtCore.Qt.AlignCenter) # 중앙 정렬
main_window.setCentralWidget(central_widget)

# 6. 창 표시
main_window.show()

# 7. 애플리케이션 실행 루프 시작
# 이벤트 처리를 시작하고 창을 화면에 유지합니다.
sys.exit(app.exec())