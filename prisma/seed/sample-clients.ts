import { prisma } from "../../src/lib/prisma";

async function seedSampleCustomers() {
  try {
    console.log("👥 Creating sample customers...");

    // Limpiar datos existentes (respetando FKs: Lead → Customer/Vehicle;
    // borrar Lead cascadea Budget → BudgetConcept/BudgetPart)
    console.log("🧹 Cleaning existing customer data...");
    await prisma.lead.deleteMany({});
    await prisma.customerVehicle.deleteMany({});
    await prisma.customer.deleteMany({});
    console.log("✅ Existing data cleaned");

    // Obtener Argentina y una provincia
    const argentina = await prisma.country.findUnique({
      where: { code: "AR" }
    });

    const buenosAires = await prisma.state.findFirst({
      where: { 
        name: "Buenos Aires",
        countryId: argentina?.id
      }
    });

    // Obtener el rol customer
    const customerRole = await prisma.role.findUnique({
      where: { name: "customer" }
    });

    if (!argentina || !buenosAires || !customerRole) {
      throw new Error("Missing required data. Make sure countries-states and roles seeds have been run.");
    }

    // Crear customers de ejemplo
    const sampleCustomers = [
      {
        name: "García, Juan Carlos",
        email: "juan.garcia@email.com",
        phone: "+54 9 11 2345-6789",
        dni: "12345678",
        dniType: "DNI",
        city: "La Plata",
        cp: "1900",
        address: "Av. 7 N° 1234"
      },
      {
        name: "Rodríguez, María Elena",
        email: "maria.rodriguez@email.com", 
        phone: "+54 9 11 8765-4321",
        dni: "87654321",
        dniType: "DNI",
        city: "Mar del Plata",
        cp: "7600",
        address: "Calle San Martín 567"
      },
      {
        name: "López, Carlos Alberto",
        email: "carlos.lopez@email.com",
        phone: "+54 9 11 5555-1234",
        dni: "23456789",
        dniType: "DNI",
        city: "Bahía Blanca",
        cp: "8000",
        address: "Av. Colón 890"
      }
    ];

    console.log("🏭️ Creating customers...");

    for (const customerData of sampleCustomers) {
      const customer = await prisma.customer.create({
        data: {
          ...customerData,
          countryId: argentina.id,
          stateId: buenosAires.id,
          roleId: customerRole.id
        },
        include: {
          country: true,
          state: true,
          role: true
        }
      });

      console.log(`✅ Customer created: ${customer.name} (${customer.email})`);

      // Crear vehículo de ejemplo para cada customer
      const vehicle = await prisma.customerVehicle.create({
        data: {
          customerId: customer.id,
          brand: customer.name.includes("García") ? "Toyota" : 
                 customer.name.includes("Rodríguez") ? "Ford" : "Volkswagen",
          model: customer.name.includes("García") ? "Corolla" : 
                 customer.name.includes("Rodríguez") ? "Focus" : "Golf",
          year: customer.name.includes("García") ? "2020" : 
                customer.name.includes("Rodríguez") ? "2019" : "2021",
          domain: customer.name.includes("García") ? "ABC123" : 
                  customer.name.includes("Rodríguez") ? "DEF456" : "GHI789",
          secure: "La Caja",
          thirdPartySecure: "Federación Patronal"
        }
      });

      console.log(`🚗 Vehicle created: ${vehicle.brand} ${vehicle.model} (${vehicle.domain})`);
    }

    // Mostrar resumen
    console.log("\n📊 Final summary:");
    
    const customers = await prisma.customer.findMany({
      include: {
        vehicles: true,
        country: true,
        state: true,
        role: true
      }
    });

    customers.forEach(customer => {
      console.log(`👤 ${customer.name}`);
      console.log(`   📧 ${customer.email}`);
      console.log(`   📱 ${customer.phone}`);
      console.log(`   📍 ${customer.city}, ${customer.state.name}, ${customer.country.name}`);
      console.log(`   🚗 Vehicles: ${customer.vehicles.length}`);
      customer.vehicles.forEach(vehicle => {
        console.log(`      ${vehicle.brand} ${vehicle.model} ${vehicle.year} (${vehicle.domain})`);
      });
      console.log("");
    });

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
    console.log("🔌 Disconnected from database");
  }
}

seedSampleCustomers();