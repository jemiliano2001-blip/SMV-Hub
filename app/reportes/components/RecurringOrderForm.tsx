"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

const schema = z.object({
  sku: z.string().min(1, "SKU is required"),
  productName: z.string().min(1, "Product name is required"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  frequency: z.enum(["weekly", "biweekly", "monthly", "quarterly"]),
  preferredSupplier: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function RecurringOrderForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      quantity: 1,
      frequency: "monthly",
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setSuccessMsg("");
    try {
      await addDoc(collection(db, "subscriptions"), {
        ...data,
        createdAt: serverTimestamp(),
        status: "active",
        nextOrderDate: calculateNextOrderDate(data.frequency),
      });
      setSuccessMsg("¡Suscripción de compra recurrente guardada exitosamente!");
      reset();
    } catch (error) {
      console.error("Error adding recurring order:", error);
      alert("Hubo un error al guardar la suscripción.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateNextOrderDate = (frequency: string) => {
    const now = new Date();
    switch (frequency) {
      case "weekly":
        now.setDate(now.getDate() + 7);
        break;
      case "biweekly":
        now.setDate(now.getDate() + 14);
        break;
      case "monthly":
        now.setMonth(now.getMonth() + 1);
        break;
      case "quarterly":
        now.setMonth(now.getMonth() + 3);
        break;
    }
    return now;
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Nueva Compra Recurrente</h2>
      <p className="text-sm text-gray-500 mb-6">
        Automatiza las compras de insumos que se necesitan regularmente.
      </p>

      {successMsg && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md border border-green-200">
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">SKU / Número de Parte</label>
            <input
              type="text"
              {...register("sku")}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              placeholder="Ej. MSC-12345"
            />
            {errors.sku && <p className="mt-1 text-xs text-red-600">{errors.sku.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Nombre del Producto</label>
            <input
              type="text"
              {...register("productName")}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              placeholder="Ej. Fresas de Carburo 1/4"
            />
            {errors.productName && <p className="mt-1 text-xs text-red-600">{errors.productName.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Cantidad</label>
            <input
              type="number"
              {...register("quantity", { valueAsNumber: true })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            />
            {errors.quantity && <p className="mt-1 text-xs text-red-600">{errors.quantity.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Frecuencia</label>
            <select
              {...register("frequency")}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            >
              <option value="weekly">Semanal</option>
              <option value="biweekly">Quincenal</option>
              <option value="monthly">Mensual</option>
              <option value="quarterly">Trimestral</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Proveedor Preferido (Opcional)</label>
          <input
            type="text"
            {...register("preferredSupplier")}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            placeholder="Dejar en blanco para usar el más económico"
          />
        </div>

        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isSubmitting ? "Guardando..." : "Programar Compra"}
          </button>
        </div>
      </form>
    </div>
  );
}
