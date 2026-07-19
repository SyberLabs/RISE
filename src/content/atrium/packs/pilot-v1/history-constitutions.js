const join = lines => lines.join(' ');

export const HISTORY_CONSTITUTION_PAYLOADS = Object.freeze({
  'pass-us-constitution': join([
    'We the People of the United States, in Order to form a more perfect Union, establish Justice, insure domestic Tranquility,',
    'provide for the common defence, promote the general Welfare, and secure the Blessings of Liberty to ourselves and our Posterity,',
    'do ordain and establish this Constitution for the United States of America.',
    'All legislative Powers herein granted shall be vested in a Congress of the United States, which shall consist of a Senate and House of Representatives.'
  ]),
  'pass-federalist-10': join([
    'Among the numerous advantages promised by a well constructed union, none deserves to be more accurately developed than its tendency to break and control the violence of faction.',
    'By a faction I understand a number of citizens, whether amounting to a majority or minority of the whole,',
    'who are united and actuated by some common impulse of passion, or of interest, adverse to the rights of other citizens, or to the permanent and aggregate interests of the community.',
    'There are two methods of curing the mischiefs of faction: The one, by removing its causes; the other, by controlling its effects.',
    'Liberty is to faction, what air is to fire, an aliment without which it instantly expires.'
  ]),
  'pass-cadiz': join([
    'Art. 1º. La Nación española es la reunión de todos los españoles de ambos hemisferios.',
    'Art. 2º. La Nación española es libre e independiente, y no es ni puede ser patrimonio de ninguna familia ni persona.',
    'Art. 3º. La soberanía reside esencialmente en la Nación, y por lo mismo pertenece a ésta exclusivamente el derecho de establecer sus leyes fundamentales.',
    'Art. 4º. La Nación está obligada a conservar y proteger por leyes sabias y justas la libertad civil, la propiedad y los demás derechos legítimos de todos los individuos que la componen.'
  ]),
  'pass-angostura': join([
    'El sistema de gobierno más perfecto es aquel que produce mayor suma de felicidad posible, mayor suma de seguridad social y mayor suma de estabilidad política.',
    'A vosotros toca resolver el problema.',
    '¿Cómo, después de haber roto todas las trabas de nuestra antigua opresión podemos hacer la obra maravillosa de evitar que los restos de nuestros duros hierros no se cambien en armas liberticidas?',
    'Un gobierno republicano ha sido, es, y debe ser el de Venezuela;',
    'sus bases deben ser la soberanía del pueblo, la división de los poderes, la libertad civil, la proscripción de la esclavitud, la abolición de la monarquía y de los privilegios.'
  ]),
  'pass-monroe-message': join([
    'The American continents, by the free and independent condition which they have assumed and maintain,',
    'are henceforth not to be considered as subjects for future colonization by any European powers.',
    'We owe it, therefore, to candor and to the amicable relations existing between the United States and those powers to declare',
    'that we should consider any attempt on their part to extend their system to any portion of this hemisphere as dangerous to our peace and safety.',
    'With the existing colonies or dependencies of any European power we have not interfered and shall not interfere.'
  ])
});
