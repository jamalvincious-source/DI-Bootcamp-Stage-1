# List Methods Exercise

# You have a list
basket = ["Banana", "Apples", "Oranges", "Blueberries"]
print("Original list:", basket)

# Remove "Banana" from the list
basket.remove("Banana")
print("After removing 'Banana':", basket)

# Remove "Blueberries" from the list
basket.remove("Blueberries")
print("After removing 'Blueberries':", basket)

# Add "Kiwi" to the end of the list
basket.append("Kiwi")
print("After appending 'Kiwi':", basket)

# Add "Apples" to the beginning of the list
basket.insert(0, "Apples")
print("After inserting 'Apples' at the beginning:", basket)

# Count how many times "Apples" appear in the list
apples_count = basket.count("Apples")
print(f"Number of 'Apples' in the list: {apples_count}")

# Empty the list
basket.clear()
print("After clearing the list:", basket)

# Print the final state of the list
print(f"Final state of the list: {basket}")
