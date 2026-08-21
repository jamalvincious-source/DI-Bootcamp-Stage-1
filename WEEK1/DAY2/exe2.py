# Tuples (Immutability) Exercise

# Create a tuple of integers
my_tuple = (1, 2, 3, 4, 5)
print("Original tuple:", my_tuple)
print("Type:", type(my_tuple))

# Try to add more integers to the tuple
# This will raise an AttributeError because tuples don't have an append method
print("\n--- Attempting to add integers to the tuple ---")
try:
    my_tuple.append(6)
except AttributeError as e:
    print(f"Error: {e}")
    print("Explanation: Tuples don't have an 'append' method because they are immutable.")

# Try to modify a tuple element directly
# This will raise a TypeError because tuples don't support item assignment
print("\n--- Attempting to modify a tuple element ---")
try:
    my_tuple[0] = 10
except TypeError as e:
    print(f"Error: {e}")
    print("Explanation: You cannot modify tuple elements because tuples are immutable.")

# Workaround: Create a new tuple by concatenating
print("\n--- Workaround: Create a new tuple ---")
new_tuple = my_tuple + (6, 7, 8)
print("Original tuple:", my_tuple)
print("New tuple with added elements:", new_tuple)

# Another workaround: Convert to list, modify, and convert back to tuple
print("\n--- Workaround: Convert to list, modify, and convert back ---")
temp_list = list(my_tuple)
temp_list.append(9)
temp_list.append(10)
modified_tuple = tuple(temp_list)
print("Original tuple:", my_tuple)
print("Modified tuple:", modified_tuple)

print("\n--- Why are tuples immutable? ---")
print("1. Performance: Immutable objects are faster and more efficient in memory")
print("2. Hashability: Tuples can be used as dictionary keys (unlike lists)")
print("3. Thread Safety: Immutable objects are safer in multi-threaded programs")
print("4. Data Integrity: Ensures data cannot be accidentally modified")
