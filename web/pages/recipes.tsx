import type { GetServerSidePropsContext } from "next";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/clients/server-props";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardHeader,
  CardDescription,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Check, Plus, Ellipsis } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  RecipeFormInput,
  Recipe,
  Ingredient,
} from "@/utils/supabase/models/recipes";
import { newRecipe, deleteRecipe } from "@/utils/supabase/queries/recipes";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { createComponentClient } from "@/utils/supabase/clients/component";
import { useEffect, useState } from "react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";


// const formSchema = Recipe
type IngredientType = z.infer<typeof Ingredient>; // dying

export function IngredientDropdown({
  selectedIngredients,
  setSelectedIngredients,
}: {
  selectedIngredients: IngredientType[];
  setSelectedIngredients: React.Dispatch<
    React.SetStateAction<IngredientType[]>
  >;
}) {
  const supabase = createComponentClient();
  const [ingredients, setIngredients] = useState<IngredientType[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    const loadIngredients = async () => {
      const { data, error } = await supabase
        .from("ingredients")
        .select("*")
        .order("name");
      if (data && !error) {
        const parsedIngred = z.array(Ingredient).safeParse(data);
        if (parsedIngred.success) {
          setIngredients(parsedIngred.data);
        } else {
          console.error(
            "Could not parse ingredient from database.",
            parsedIngred.error
          );
        }
      }
    };
    loadIngredients();
  }, [supabase]); // run on mount!

  const handleSelectIngredient = (ingredient: IngredientType) => {
    setSelectedIngredients((prevSelected) => {
      if (prevSelected.some((ing) => ing.id === ingredient.id)) {
        return prevSelected.filter((ing) => ing.id !== ingredient.id); // unselect
      }
      return [...prevSelected, ingredient]; // select
    });
    setIsOpen(false);
  };

  const addNewIngredient = async () => {
    const newIng = inputValue.toLowerCase();

    if (!newIng.trim()) {
      return; // don't wanna add empty ingrwdoents
    }

    if (ingredients.find((ing) => ing.name === newIng)) {
      // should all be in lowercase already
      return; // if it matches existing ingredient, don't want to add new one
    }

    const { data, error } = await supabase
      .from("ingredients")
      .insert({ name: newIng })
      .select()
      .single();
    // did i do the insert right? or should it just be insert(newIng)?

    if (data && !error) {
      setIngredients([...ingredients, data]);
      setSelectedIngredients([...selectedIngredients, data]);
      setInputValue("");
      setIsOpen(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline">Add ingredient</Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <Command>
          <CommandInput
            placeholder="Add an ingredient..."
            value={inputValue}
            onValueChange={setInputValue}
            onKeyDown={(e) => {
              if (e.key === "Enter" && ingredients.length === 0) {
                addNewIngredient();
              }
            }}
          />
          <CommandEmpty>
            No ingredient found, press enter to add this to your list.
          </CommandEmpty>
          <CommandGroup>
            {ingredients.map((ingredient) => (
              <CommandItem
                key={ingredient.id}
                value={ingredient.name}
                onSelect={() => handleSelectIngredient(ingredient)}
              >
                <Check
                  className={
                    "mr-2 h-4 w-4 " +
                    (selectedIngredients.some(
                      (selectedIng) => selectedIng.id === ingredient.id
                    )
                      ? "opacity-100"
                      : "opacity-0")
                  }
                />
                {ingredient.name}
              </CommandItem>
            ))}
          </CommandGroup>
          {inputValue &&
            !ingredients.some(
              (i) => i.name.toLowerCase() === inputValue.toLowerCase()
            ) && (
              <Button variant="ghost" onClick={addNewIngredient}>
                <Plus /> Add “{inputValue}”
              </Button>
            )}
        </Command>
        {selectedIngredients.length > 0 && (
          <div className="mt-4">
            <h4 className="font-medium text-sm mb-2">Selected Ingredients:</h4>
            <div className="flex flex-wrap gap-2">
              {selectedIngredients.map((ingredient) => (
                <Button
                  key={ingredient.id}
                  variant="outline"
                  className="text-xs px-2 py-1"
                  onClick={() => handleSelectIngredient(ingredient)}
                >
                  {ingredient.name} <span className="ml-1">✕</span>
                </Button>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default function Recipes({ user }: { user: User }) {
  const formSchema = RecipeFormInput;

  const [dialogOpen, setDialogOpen] = useState(false);
  const supabase = createComponentClient();
  type RecipeData = z.infer<typeof Recipe>;

  const [recipes, setRecipes] = useState<RecipeData[]>([]);

  
  // const [loading, setLoading] = useState(true)
  const [selectedIngredients, setSelectedIngredients] = useState<
    IngredientType[]
  >([]);


  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {},
  });

  useEffect(() => {
    if (form) {
      form.setValue("ingredients", selectedIngredients);
    }
  }, [selectedIngredients, form]);

  const recipeDatabase = supabase
    .channel("recipe-changes")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "recipes",
      },
      (payload) => console.log(payload)
    )
    .subscribe();

  useEffect(() => {

    const loadRecipesWithIngredients = async () => {
      // Fetch recipes
      const { data: recipes, error: recipeError } = await supabase
        .from("recipes")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (recipeError || !recipes) {
        console.error(recipeError);
        return;
      }

      // Fetch ingredients linked to each recipe
      const { data: recipeIngredients, error: ingredientError } = await supabase
        .from("recipe_ingredients")
        .select("recipe_id, ingredient_id")
        .in(
          "recipe_id",
          recipes.map((recipe) => recipe.id)
        );

      if (ingredientError) {
        console.error(ingredientError);
        return;
      }

      // Fetch all ingredients from the database
      const { data: allIngredients, error: ingredientsError } = await supabase
        .from("ingredients")
        .select("*");

      if (ingredientsError) {
        console.error(ingredientsError);
        return;
      }

      const recipesWithIngredients = recipes.map((recipe) => ({
        ...recipe,
        ingredients: recipeIngredients
          .filter((ri) => ri.recipe_id === recipe.id)
          .map(
            (ri) =>
              allIngredients.find((ing) => ing.id === ri.ingredient_id)?.name
          )
          .filter(Boolean),
      }));

      setRecipes(recipesWithIngredients);
    };

    loadRecipesWithIngredients();
  }, [supabase, user.id, recipeDatabase]);

  useEffect(() => {
    form.setValue("ingredients", selectedIngredients);
  }, [selectedIngredients, form]);

  const saveRecipe = async (values: z.infer<typeof formSchema>) => {
    const recipeResponse = await newRecipe(supabase, user.id, values);

    if (recipeResponse.data && !recipeResponse.error) {
      const recipeId = recipeResponse.data.id;

      for (const ingredient of selectedIngredients) {
        await supabase.from("recipe_ingredients").insert({
          recipe_id: recipeId,
          ingredient_id: ingredient.id,
        });
      }
      setDialogOpen(false);
    }
  };

  const removeRecipe = async (recipe_id: string) => {
    await deleteRecipe(supabase, recipe_id);
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="w-full h-screen bg-background text-foreground">
        <SidebarTrigger className="my-[1.5rem] mx-[2.5rem]" />
        <div className="min-h-[75vh] grid grid-cols-3 grid-rows-2 gap-[2rem] mx-[3rem]">
          <div className="col-start-1 col-end-2 row-start-1 row-end-2 flex flex-col justify-between">
            <h1 className="text-3xl font-bold">My Recipes</h1>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full">
                  <Plus />
                  Add New
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Recipe</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form
                    id="new-recipe"
                    onSubmit={form.handleSubmit(saveRecipe)}
                    className="space-y-8"
                  >
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Recipe Name" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Recipe Description"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="photo"
                      render={() => (
                        <FormItem>
                          <FormLabel>Picture</FormLabel>
                          <FormControl>
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  form.setValue("photo", file); // manually set file
                                }
                              }}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="ingredients"
                      render={() => (
                        // took out {field} from ()
                        <FormItem>
                          <FormLabel>Ingredients</FormLabel>
                          <FormControl>
                            <div className="flex flex-col space-y-2">
                              <Input
                                placeholder="Ingredients..."
                                value={selectedIngredients
                                  .map((ingredient) => ingredient.name)
                                  .join(", ")}
                                onChange={() => {}}
                              />
                              <IngredientDropdown
                                selectedIngredients={selectedIngredients}
                                setSelectedIngredients={setSelectedIngredients}
                              />
                            </div>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="custom_text"
                      render={(
                        { field } // took out {field} from ()
                      ) => (
                        <FormItem>
                          <FormLabel>Details</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Details about your recipe..."
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </form>
                </Form>
                <DialogFooter className="flex justify-between">
                  <DialogClose asChild>
                    <Button variant="secondary">Cancel</Button>
                  </DialogClose>
                  <Button type="submit" form="new-recipe">
                    Save
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          {recipes.map((recipe) => (
            <Card key={recipe.name}>
              <CardHeader className="flex justify-between">
                <div className="mt-[.5rem]">
                  <CardTitle>{recipe.name}</CardTitle>
                  <CardDescription>{recipe.description}</CardDescription>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost">
                      <Ellipsis />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{recipe.name}</DialogTitle>
                      <DialogDescription>
                        {recipe.description}
                      </DialogDescription>
                    </DialogHeader>
                    <div>
                      {recipe.photo && (
                        <AspectRatio ratio={4 / 3}>
                          <img
                            src={recipe.photo}
                            alt={recipe.name}
                            className="rounded-md object-cover w-full h-full"
                          />
                        </AspectRatio>
                      )}
                      <p className="mt-[1rem]">{recipe.ingredients}</p>
                      <p className="mt-[1rem]">{recipe.custom_text}</p>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="destructive"
                        className="w-full"
                        onClick={() => removeRecipe(recipe.id)}
                      >
                        Delete Recipe
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {/*{/*<p className='my-[.5rem]'>{recipe.description}</p>*/}
                {recipe.photo && (
                  <AspectRatio ratio={4 / 3}>
                    <img
                      src={recipe.photo}
                      alt={recipe.name}
                      className="rounded-md object-cover w-full h-full"
                    />
                  </AspectRatio>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </SidebarProvider>
  );
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const supabase = createClient(context);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data) {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  } // so i can push
  return {
    props: {
      user: data.user,
    },
  };
}
