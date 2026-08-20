my_name = "Alex"
user_name = input("What is your name? ")

if user_name.strip().lower() == my_name.lower():
	print("No way! We have the same name. Clearly, you have excellent taste!")
else:
	print(f"Nice to meet you, {user_name}! Our names are different, but that's okay.")
