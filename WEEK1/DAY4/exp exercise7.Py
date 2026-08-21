import random


def get_random_temp():
	return random.uniform(-10, 40)


def main():
	temperature = get_random_temp()
	print(f"The temperature right now is {temperature:.1f} degrees Celsius.")

	if temperature < 0:
		print("Brrr, that's freezing! Wear some extra layers today.")
	elif temperature <= 16:
		print("Quite chilly! Don't forget your coat.")
	elif temperature <= 23:
		print("Nice weather.")
	elif temperature <= 32:
		print("A bit warm, stay hydrated.")
	else:
		print("It's really hot! Stay cool.")


main()
