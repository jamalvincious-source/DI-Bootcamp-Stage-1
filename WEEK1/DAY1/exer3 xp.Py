# Guesses:
print(5 < 3)          # False
print(3 == 3)         # True
print(3 == "3")       # False

try:
	print("3" > 3)    # TypeError: strings and integers cannot be compared
except TypeError as error:
	print(type(error).__name__)

print("Hello" == "hello")  # False
