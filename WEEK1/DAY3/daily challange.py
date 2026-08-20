word = input("vincent momanyi: ")
character_indices = {}

for index, character in enumerate(word):
	if character in character_indices:
		character_indices[character].append(index)
	else:
		character_indices[character] = [index]

print(character_indices)

1. User Input:

Ask the user to enter a word.
Store the input word in a variable.
2. Creating the Dictionary:

Iterate through each character of the input word using a loop.
And check if the character is already a key in the dictionary.

    * If it is, append the current index to the list associated with that key.
    * If it is not, create a new key-value pair in the dictionary.
Ensure that the characters (keys) are strings.
Ensure that the indices (values) are stored in lists.
3. Expected Output:

For the input “dodo”, the output should be: {"d": [0, 2], "o": [1, 3]}.
For the input “froggy”, the output should be: {"f": [0], "r": [1], "o": [2], "g": [3, 4], "y": [5]}.
For the input “grapes”, the output should be: {"g": [0], "r": [1], "a": [2], "p": [3], "e": [4], "s": [5]}.


