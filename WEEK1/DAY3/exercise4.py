users = ["Mickey", "Minnie", "Donald", "Ariel", "Pluto"]

characters_to_indices = {character: index for index, character in enumerate(users)}
indices_to_characters = {index: character for index, character in enumerate(users)}
sorted_characters_to_indices = {
	character: index for index, character in enumerate(sorted(users))
}

print(characters_to_indices)
print(indices_to_characters)
print(sorted_characters_to_indices)
