my_fav_numbers = {3, 7, 21}

my_fav_numbers.add(42)
last_added_number = 99
my_fav_numbers.add(last_added_number)
my_fav_numbers.remove(last_added_number)

friend_fav_numbers = {5, 7, 13}

our_fav_numbers = my_fav_numbers | friend_fav_numbers

print("My favorite numbers:", my_fav_numbers)
print("Friend's favorite numbers:", friend_fav_numbers)
print("Our favorite numbers:", our_fav_numbers)
