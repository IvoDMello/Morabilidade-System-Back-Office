import { redirect } from "next/navigation";

export default function Home() {
  // Decidir é a tela de abertura: é a fila que espera ação.
  redirect("/decidir");
}
