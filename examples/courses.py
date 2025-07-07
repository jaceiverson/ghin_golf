from rich import print

from ghin.courses import Course

if __name__ == "__main__":
    # # course specific data
    course = 14062  # remuda
    c = Course(course)
    details = c.get_course_details(table=True)
    # print(details)
    ghin_number = 1104482
    my_course_handicap = c.get_course_handicaps(ghin_number=ghin_number, table=True)
    # print(my_course_handicap)
